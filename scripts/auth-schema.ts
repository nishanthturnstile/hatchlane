import { authForSchema } from "../server/auth/auth.ts";
import { getDatabase } from "../server/db/database.ts";

export const auth = authForSchema(getDatabase());
