import { Kysely, PostgresDialect } from "kysely";
import { getPool } from "./pool.ts";

export type Database = Kysely<Record<string, never>>;

let database: Database | undefined;

export function getDatabase(): Database {
  database ??= new Kysely({
    dialect: new PostgresDialect({ pool: getPool() }),
  });
  return database;
}
