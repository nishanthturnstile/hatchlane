import { sql } from "kysely";
import type { SiteDeletionImpact, SiteFields } from "../../lib/schemas.ts";
import type { Viewer } from "../auth/auth.ts";
import { type Database, getDatabase } from "../db/database.ts";
import { Problem } from "./problems.ts";

export type SiteMembership = SiteFields & {
  id: string;
  role: "admin" | "member";
};

type Onboarding = {
  siteId: string | null;
  completedAt: Date | null;
  mapResolvedAt: Date | null;
};

export async function listSites(viewer: Viewer, db = getDatabase()) {
  const result = await sql<SiteMembership>`
    SELECT s.slug AS id, s.name, s.time_zone AS "timeZone", s.description, m.role
    FROM site_member m JOIN site s ON s.slug = m.site_slug
    WHERE m.user_id = ${viewer.id}
    ORDER BY lower(s.name), s.slug
  `.execute(db);
  return result.rows;
}

export async function getSite(viewer: Viewer, id: string, db = getDatabase()) {
  const result = await sql<SiteMembership>`
    SELECT s.slug AS id, s.name, s.time_zone AS "timeZone", s.description, m.role
    FROM site_member m JOIN site s ON s.slug = m.site_slug
    WHERE m.user_id = ${viewer.id} AND s.slug = ${id}
  `.execute(db);
  return result.rows[0];
}

export async function getOnboarding(viewer: Viewer, db = getDatabase()) {
  const result = await sql<Onboarding>`
    SELECT site_id AS "siteId", completed_at AS "completedAt", map_resolved_at AS "mapResolvedAt"
    FROM admin_onboarding WHERE user_id = ${viewer.id}
  `.execute(db);
  return result.rows[0];
}

export async function needsOnboarding(viewer: Viewer) {
  return viewer.role === "admin" && !(await getOnboarding(viewer))?.completedAt;
}

export async function requireAdministrator(viewer: Viewer, db: Database) {
  if (viewer.role !== "admin")
    throw new Problem(403, "Administrator access is required.");
  const result = await sql`
    SELECT 1 FROM "user" WHERE id = ${viewer.id} AND role = 'admin'
    AND NOT coalesce(banned, false) FOR SHARE
  `.execute(db);
  if (!result.rows.length)
    throw new Problem(403, "Administrator access is required.");
}

export async function lockSiteAdministrator(
  viewer: Viewer,
  siteId: string,
  db: Database,
) {
  await requireAdministrator(viewer, db);
  const site = await sql`
    SELECT 1 FROM site WHERE slug = ${siteId} FOR KEY SHARE
  `.execute(db);
  if (!site.rows.length) throw new Problem(404, "Site not found.");
  const { rows } = await sql`
    SELECT 1 FROM site_member
    WHERE site_slug = ${siteId} AND user_id = ${viewer.id} AND role = 'admin'
    FOR SHARE
  `.execute(db);
  if (!rows.length)
    throw new Problem(403, "Site Administrator access is required.");
}

export async function startOnboarding(viewer: Viewer) {
  await getDatabase()
    .transaction()
    .execute(async (tx) => {
      await requireAdministrator(viewer, tx);
      await sql`
      INSERT INTO admin_onboarding (user_id) VALUES (${viewer.id})
      ON CONFLICT (user_id) DO NOTHING
    `.execute(tx);
    });
}

export async function insertSite(
  tx: Database,
  viewer: Viewer,
  input: SiteFields,
  id: string,
) {
  const created = await sql<{ id: string }>`
    INSERT INTO site (slug, name, time_zone, description)
    VALUES (${id}, ${input.name}, ${input.timeZone}, ${input.description})
    ON CONFLICT (slug) DO NOTHING
    RETURNING slug AS id
  `.execute(tx);
  if (created.rows.length === 0) {
    const existing = await getSite(viewer, id, tx);
    if (
      existing?.role !== "admin" ||
      existing.name !== input.name ||
      existing.timeZone !== input.timeZone ||
      existing.description !== input.description
    )
      throw new Problem(409, "This site request has already been used.");
    return false;
  }
  await sql`
    INSERT INTO site_member (site_slug, user_id, duties, role)
    VALUES (${id}, ${viewer.id}, '{}', 'admin')
  `.execute(tx);
  return true;
}

export async function createOnboardingSite(viewer: Viewer, input: SiteFields) {
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      await requireAdministrator(viewer, tx);
      const result = await sql<Onboarding>`
      SELECT site_id AS "siteId", completed_at AS "completedAt", map_resolved_at AS "mapResolvedAt"
      FROM admin_onboarding WHERE user_id = ${viewer.id} FOR UPDATE
    `.execute(tx);
      const progress = result.rows[0];
      if (!progress) throw new Problem(409, "Start onboarding first.");
      if (progress.siteId) return progress.siteId;
      if (progress.completedAt)
        throw new Problem(409, "Create more sites from the workspace.");

      const id = crypto.randomUUID();
      await insertSite(tx, viewer, input, id);
      await sql`UPDATE admin_onboarding SET site_id = ${id} WHERE user_id = ${viewer.id}`.execute(
        tx,
      );
      return id;
    });
}

export async function finishOnboarding(viewer: Viewer) {
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      await requireAdministrator(viewer, tx);
      const result = await sql<{ siteId: string | null }>`
      UPDATE admin_onboarding
      SET completed_at = coalesce(completed_at, now())
      WHERE user_id = ${viewer.id}
        AND (completed_at IS NOT NULL OR (site_id IS NOT NULL AND map_resolved_at IS NOT NULL))
      RETURNING site_id AS "siteId"
    `.execute(tx);
      const progress = result.rows[0];
      if (!progress)
        throw new Problem(
          409,
          "Create your first site and finish the site location step before continuing.",
        );
      return progress.siteId;
    });
}

export async function getSiteDeletionImpact(
  siteId: string,
  db = getDatabase(),
) {
  const { rows } = await sql<SiteDeletionImpact>`
    SELECT EXISTS (SELECT 1 FROM site_map WHERE site_id = ${siteId}) AS "hasMap",
      (SELECT count(*)::int FROM site_asset WHERE site_id = ${siteId}) AS manholes,
      (SELECT count(*)::int FROM manhole_lock l JOIN site_asset a ON a.id = l.manhole_id
        WHERE a.site_id = ${siteId}) AS locks,
      (SELECT count(*)::int FROM site_member WHERE site_slug = ${siteId}) AS memberships,
      (SELECT count(*)::int FROM site_invitation WHERE site_id = ${siteId}) AS invitations
  `.execute(db);
  return rows[0];
}

export async function deleteSite(
  viewer: Viewer,
  siteId: string,
  name: string,
  impact: SiteDeletionImpact,
) {
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      const { rows } = await sql<{ name: string }>`
        SELECT name FROM site WHERE slug = ${siteId} FOR UPDATE
      `.execute(tx);
      if (!rows.length) throw new Problem(404, "Site not found.");
      await lockSiteAdministrator(viewer, siteId, tx);
      if (rows[0].name !== name)
        throw new Problem(409, "Enter the site name exactly as shown.");
      const current = await getSiteDeletionImpact(siteId, tx);
      const keys = Object.keys(impact) as (keyof SiteDeletionImpact)[];
      if (keys.some((key) => impact[key] !== current[key])) {
        throw new Problem(
          409,
          "Site data changed. Review the updated counts and confirm again.",
          "site-impact-changed",
        );
      }
      await sql`
        UPDATE admin_onboarding SET site_id = NULL, map_resolved_at = NULL
        WHERE site_id = ${siteId}
      `.execute(tx);
      await sql`DELETE FROM site WHERE slug = ${siteId}`.execute(tx);
    });
}
