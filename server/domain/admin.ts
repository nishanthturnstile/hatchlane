import { sql } from "kysely";
import type { z } from "zod";
import type { administratorFields } from "../../lib/schemas.ts";
import { authInTransaction } from "../auth/auth.ts";
import { getDatabase } from "../db/database.ts";

export async function hasAdministrator() {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS(SELECT 1 FROM "user" WHERE role = 'admin')
  `.execute(getDatabase());
  return rows[0].exists;
}

export async function bootstrapAdministrator(
  input: z.infer<typeof administratorFields>,
) {
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      // Serialize initial setup so concurrent CLI runs cannot both provision an Admin.
      await sql`SELECT pg_advisory_xact_lock(hashtext('hatchlane:first-admin'))`.execute(
        tx,
      );
      const { rows } = await sql<{ exists: boolean }>`
      SELECT EXISTS(SELECT 1 FROM "user" WHERE role = 'admin')
    `.execute(tx);
      if (rows[0].exists) return false;

      await authInTransaction(tx).api.createUser({
        body: { ...input, role: "admin" },
      });
      return true;
    });
}
