import { readFileSync } from "node:fs";
import { runner } from "node-pg-migrate";

const passwordFile = process.env.PGPASSWORD_FILE;
if (!passwordFile || process.env.PGUSER !== "hatchlane_migrator") {
  throw new Error("Run migrations with the Hatchlane migrator credentials.");
}
const applied = await runner({
  databaseUrl: { password: readFileSync(passwordFile, "utf8").trimEnd() },
  dir: new URL("../server/db/migrations", import.meta.url).pathname,
  schema: "hatchlane",
  migrationsTable: "schema_migrations",
  direction: "up",
  log: () => {},
});
console.log(`Applied ${applied.length} database migration(s).`);
