import { defineConfig } from "@playwright/test";

const baseURL = process.env.HATCHLANE_TEST_ORIGIN;
if (!baseURL || !process.env.HATCHLANE_TEST_INBOX) {
  throw new Error("Run the browser suite with ./scripts/test-local.sh --auth.");
}

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 90_000,
  use: { baseURL, ignoreHTTPSErrors: true },
});
