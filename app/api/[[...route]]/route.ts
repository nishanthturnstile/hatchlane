import { handle } from "@hono/vercel";
import { api } from "@/server/api/app";

export const runtime = "nodejs";

export const GET = handle(api);
