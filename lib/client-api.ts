export class RequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function post<T = void>(
  path: string,
  data: object = {},
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429)
      throw new Error("Too many attempts. Wait a minute and try again.");
    throw new RequestError(
      typeof result?.message === "string"
        ? result.message
        : "Hatchlane could not complete the request. Try again.",
      typeof result?.code === "string" ? result.code : undefined,
    );
  }
  return result as T;
}

export function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Try again.";
}
