import type { ContentfulStatusCode } from "hono/utils/http-status";

export class Problem extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
