import { readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { sql } from "kysely";
import { passwordLimits } from "../../lib/schemas.ts";
import { type Database, getDatabase } from "../db/database.ts";
import { sendAccountEmail } from "./mail.ts";

export function getPublicOrigin(): string {
  const value = process.env.HATCHLANE_PUBLIC_URL;
  if (!value) throw new Error("HATCHLANE_PUBLIC_URL is required");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("HATCHLANE_PUBLIC_URL must be an HTTPS origin");
  }
  return url.origin;
}

function createAuth(
  db: Database,
  origin: string,
  secret: string,
  transaction: boolean,
) {
  return betterAuth({
    appName: "Hatchlane",
    baseURL: origin,
    basePath: "/api/auth",
    secret,
    database: { db, type: "postgres", schemaName: "hatchlane", transaction },
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: passwordLimits.min,
      maxPasswordLength: passwordLimits.max,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        if ("banned" in user && user.banned) return;
        const link = new URL("/reset-password", origin);
        link.searchParams.set("token", token);
        void sendAccountEmail(
          user.email,
          "Reset your Hatchlane password",
          `Open this link to choose a new password. It expires in 30 minutes.\n\n${link}\n\nYou can ignore this email if you didn't request a reset.`,
        ).catch(() =>
          console.error("Could not deliver a password reset email"),
        );
      },
      onPasswordReset: async ({ user }) => {
        await sql`
          UPDATE account_gate SET state = 'active', reset_id = NULL
          WHERE user_id = ${user.id} AND state <> 'active'
        `.execute(db);
      },
    },
    verification: { storeIdentifier: "hashed" },
    session: { cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
        "/reset-password": { window: 60, max: 10 },
      },
    },
    advanced: {
      // The main adapter checks the migrated schema. A checked-out transaction
      // cannot open the separate connection required for that introspection.
      database: { validateSchema: transaction },
      useSecureCookies: true,
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    plugins: [admin()],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (await hasPasswordGate(session.userId, db)) {
              throw new APIError("FORBIDDEN", {
                code: "PASSWORD_CHANGE_REQUIRED",
                message:
                  "Use Forgot password to set a new password before signing in.",
              });
            }
          },
        },
      },
    },
    logger: { disabled: true },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
let authSecret: string | undefined;

function getSecret(): string {
  if (!authSecret) {
    const path = process.env.HATCHLANE_AUTH_SECRET_FILE;
    if (!path) throw new Error("HATCHLANE_AUTH_SECRET_FILE is required");
    authSecret = readFileSync(path, "utf8").trim();
  }
  return authSecret;
}

export function getAuth() {
  auth ??= createAuth(getDatabase(), getPublicOrigin(), getSecret(), true);
  return auth;
}

/** Bind Better Auth writes to the transaction already opened by the caller. */
export function authInTransaction(transaction: Database) {
  return createAuth(transaction, getPublicOrigin(), getSecret(), false);
}

export function authForSchema(db: Database) {
  return createAuth(
    db,
    "https://schema.hatchlane.localhost",
    "hatchlane-schema-only-placeholder-secret",
    true,
  );
}

export async function getViewer(headers: Headers) {
  const session = await getAuth().api.getSession({
    headers,
    query: { disableRefresh: true },
  });
  if (
    !session ||
    session.user.banned ||
    (await hasPasswordGate(session.user.id, getDatabase()))
  )
    return null;
  return session.user;
}

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

async function hasPasswordGate(userId: string, db: Database) {
  const { rows } =
    await sql`SELECT 1 FROM account_gate WHERE user_id = ${userId} AND state <> 'active'`.execute(
      db,
    );
  return rows.length > 0;
}
