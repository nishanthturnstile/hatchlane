import { cancel, isCancel, outro, password, text } from "@clack/prompts";
import { email, name, password as passwordSchema } from "../lib/schemas.ts";
import { getPool } from "../server/db/pool.ts";
import {
  bootstrapAdministrator,
  hasAdministrator,
} from "../server/domain/admin.ts";

function cancelled(value: unknown): value is symbol {
  if (!isCancel(value)) return false;
  cancel("Administrator setup cancelled.");
  return true;
}

async function setup() {
  if (!process.stdin.isTTY) {
    throw new Error("Run administrator setup in an interactive terminal.");
  }
  if (await hasAdministrator()) {
    outro("An Administrator is already configured.");
    return;
  }

  const displayName = await text({
    message: "Administrator name",
    validate: name,
  });
  if (cancelled(displayName)) return;

  const address = await text({ message: "Email address", validate: email });
  if (cancelled(address)) return;

  const secret = await password({
    message: "Password (12 or more characters)",
    validate: passwordSchema,
  });
  if (cancelled(secret)) return;

  const confirmation = await password({
    message: "Confirm password",
    clearOnError: true,
    validate: (value) =>
      value === secret ? undefined : "The passwords do not match.",
  });
  if (cancelled(confirmation)) return;

  const created = await bootstrapAdministrator({
    name: name.parse(displayName),
    email: email.parse(address),
    password: secret,
  });
  outro(
    created
      ? "Administrator created. Sign in to set up your first site."
      : "An Administrator is already configured.",
  );
}

try {
  await setup();
} catch {
  console.error(
    "Administrator setup failed. Check that the local stack and migrations are ready, then try again.",
  );
  process.exitCode = 1;
} finally {
  await getPool()
    .end()
    .catch(() => {});
}
