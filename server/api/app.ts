import { Hono } from "hono";
import { getPool } from "@/server/db/pool";

export const api = new Hono().basePath("/api");

api.get("/health", async (context) => {
  context.header("Cache-Control", "no-store");

  try {
    await getPool().query("SELECT 1");
  } catch {
    return context.json({ status: "unavailable" }, 503);
  }

  return context.json({ status: "ok" });
});
