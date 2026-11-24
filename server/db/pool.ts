import { readFileSync } from "node:fs";
import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const passwordFile = process.env.PGPASSWORD_FILE;
    if (!passwordFile) {
      throw new Error("PGPASSWORD_FILE is required");
    }

    pool = new Pool({
      password: readFileSync(passwordFile, "utf8").trimEnd(),
      max: 5,
      connectionTimeoutMillis: 1500,
      statement_timeout: 1500,
      query_timeout: 2000,
    });
    pool.on("error", () => {
      console.error("An idle PostgreSQL connection was lost");
    });
  }

  return pool;
}
