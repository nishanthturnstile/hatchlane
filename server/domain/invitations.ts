import { createHash, randomBytes } from "node:crypto";
import { sql } from "kysely";
import {
  authInTransaction,
  getPublicOrigin,
  type Viewer,
} from "../auth/auth.ts";
import { sendAccountEmail } from "../auth/mail.ts";
import { getDatabase } from "../db/database.ts";
import { Problem } from "./problems.ts";
import { getSite, lockSiteAdministrator } from "./sites.ts";

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendInvitation(
  viewer: Viewer,
  siteId: string,
  email: string,
) {
  const token = randomBytes(32).toString("base64url");
  const siteName = await getDatabase()
    .transaction()
    .execute(async (tx) => {
      if (viewer.role !== "admin")
        throw new Problem(403, "Administrator access is required.");
      const site = await getSite(viewer, siteId, tx);
      if (site?.role !== "admin") throw new Problem(404, "Site not found.");
      await lockSiteAdministrator(viewer, siteId, tx);

      const existing = await sql`
      SELECT 1 FROM site_member m JOIN "user" u ON u.id = m.user_id
      WHERE m.site_slug = ${siteId} AND u.email = ${email}
    `.execute(tx);
      if (existing.rows.length)
        throw new Problem(409, "This person is already a member of the site.");

      const invitation = await sql`
      INSERT INTO site_invitation (site_id, email, token_hash, invited_by, expires_at)
      VALUES (${siteId}, ${email}, ${digest(token)}, ${viewer.id}, now() + interval '7 days')
      ON CONFLICT (site_id, email) DO UPDATE SET
        token_hash = excluded.token_hash, invited_by = excluded.invited_by,
        expires_at = excluded.expires_at
      WHERE site_invitation.accepted_at IS NULL
      RETURNING 1
    `.execute(tx);
      if (!invitation.rows.length)
        throw new Problem(409, "This person is already a member of the site.");
      return site.name;
    });

  const link = new URL("/invite", getPublicOrigin());
  link.searchParams.set("token", token);
  try {
    await sendAccountEmail(
      email,
      "You're invited to a Hatchlane site",
      `You've been invited to join ${siteName}. Open the link to accept the invitation. It expires in 7 days.\n\n${link}`,
    );
  } catch {
    throw new Problem(
      503,
      "The invitation could not be delivered. Try sending it again.",
    );
  }
}

type Invitation = {
  siteId: string;
  email: string;
  siteName: string;
  hasAccount: boolean;
};

export async function readInvitation(token: string) {
  const { rows } = await sql<Invitation>`
    SELECT i.site_id AS "siteId", i.email, s.name AS "siteName",
      EXISTS(SELECT 1 FROM "user" WHERE email = i.email) AS "hasAccount"
    FROM site_invitation i JOIN site s ON s.slug = i.site_id
    WHERE i.token_hash = ${digest(token)} AND i.accepted_at IS NULL
      AND i.expires_at > now()
  `.execute(getDatabase());
  return rows[0];
}

export async function acceptInvitation(
  token: string,
  viewer: Viewer | null,
  credentials?: { name: string; password: string },
) {
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      // Lock in site-first order so site deletion cannot race a membership insert.
      const tokenHash = digest(token);
      const site = await sql`
        SELECT s.slug FROM site s JOIN site_invitation i ON i.site_id = s.slug
        WHERE i.token_hash = ${tokenHash} FOR KEY SHARE OF s
      `.execute(tx);
      if (!site.rows.length)
        throw new Problem(
          410,
          "This invitation has expired or already been used.",
        );
      const { rows } = await sql<Pick<Invitation, "siteId" | "email">>`
      SELECT site_id AS "siteId", email FROM site_invitation
      WHERE token_hash = ${tokenHash} AND accepted_at IS NULL
        AND expires_at > clock_timestamp() FOR UPDATE
    `.execute(tx);
      const invite = rows[0];
      if (!invite)
        throw new Problem(
          410,
          "This invitation has expired or already been used.",
        );

      // Serialize activations for this address across invitations from different sites.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`hatchlane:invite:${invite.email}`}))`.execute(
        tx,
      );
      const account = await sql<{ id: string; banned: boolean | null }>`
      SELECT id, banned FROM "user" WHERE email = ${invite.email} FOR SHARE
    `.execute(tx);
      const existing = account.rows[0];
      let userId: string;
      if (viewer) {
        if (!existing || existing.id !== viewer.id || existing.banned) {
          throw new Problem(
            403,
            "Sign in with the email address on the invitation.",
          );
        }
        userId = viewer.id;
      } else {
        if (existing)
          throw new Problem(
            409,
            "Sign in with your existing account to accept this invitation.",
            "sign-in",
          );
        if (!credentials)
          throw new Problem(
            400,
            "Set your name and password to accept the invitation.",
          );
        const { user } = await authInTransaction(tx).api.createUser({
          body: {
            ...credentials,
            email: invite.email,
            role: "user",
            data: { emailVerified: true },
          },
        });
        userId = user.id;
      }

      await sql`
      INSERT INTO site_member (site_slug, user_id, duties, role)
      VALUES (${invite.siteId}, ${userId}, '{}', 'member') ON CONFLICT DO NOTHING
    `.execute(tx);
      await sql`
      UPDATE site_invitation SET accepted_at = now(), accepted_by = ${userId}
      WHERE site_id = ${invite.siteId} AND email = ${invite.email}
    `.execute(tx);
      return invite.siteId;
    });
}
