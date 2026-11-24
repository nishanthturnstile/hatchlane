import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import type { Asset } from "../lib/assets";
import type { ManholeLock } from "../lib/manhole-locks";

const origin = process.env.HATCHLANE_TEST_ORIGIN ?? "";
const inbox = process.env.HATCHLANE_TEST_INBOX ?? "";
const admin = {
  email: "admin@example.test",
  password: "disposable-admin-password",
};
const member = {
  email: "member@example.test",
  password: "disposable-member-password",
};
const replacement = "disposable-replacement-password";

async function signIn(
  page: Page,
  account: { email: string; password: string },
) {
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function send(request: APIRequestContext, path: string, data: object) {
  return request.post(path, { headers: { Origin: origin }, data });
}

async function invite(page: Page, email: string) {
  await page.getByLabel("Member email address").fill(email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
}

async function dragSiteCenter(page: Page, form: Page | Locator) {
  const picker = form.getByRole("region", {
    name: "Choose site center on the map",
  });
  await expect(picker).toHaveAttribute("data-map-status", "ready", {
    timeout: 15_000,
  });
  const canvas = picker.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Expected a visible map canvas.");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const latitude = form.getByLabel("Latitude");
  const longitude = form.getByLabel("Longitude");
  const previousLatitude = await latitude.inputValue();
  const previousLongitude = await longitude.inputValue();
  await page.mouse.move(x, y);
  await page.mouse.down();
  let releaseLatitude: string;
  let releaseLongitude: string;
  try {
    await page.mouse.move(x - 20, y - 12, { steps: 3 });
    await expect(latitude).not.toHaveValue(previousLatitude);
    await expect(longitude).not.toHaveValue(previousLongitude);
    const midwayLongitude = await longitude.inputValue();
    await page.mouse.move(x - 42, y - 24, { steps: 3 });
    await expect(longitude).not.toHaveValue(midwayLongitude);
    releaseLatitude = await latitude.inputValue();
    releaseLongitude = await longitude.inputValue();
  } finally {
    await page.mouse.up();
  }
  await expect(latitude).toHaveValue(releaseLatitude);
  await expect(longitude).toHaveValue(releaseLongitude);
  return {
    latitude: Number(releaseLatitude),
    longitude: Number(releaseLongitude),
  };
}

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] };
async function emailLink(
  request: APIRequestContext,
  email: string,
  path: string,
  previous: readonly string[] = [],
) {
  let link: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${inbox}/api/v1/messages`);
      expect(response.ok()).toBe(true);
      const mail = (await response.json()) as { messages: MailSummary[] };
      for (const summary of mail.messages) {
        if (!summary.To.some(({ Address }) => Address === email)) continue;
        const detail = await request.get(
          `${inbox}/api/v1/message/${summary.ID}`,
        );
        const { Text } = (await detail.json()) as { Text: string };
        const match = Text.match(/https:\/\/[^\s]+/g)?.find((value) => {
          const url = new URL(value);
          return (
            url.origin === origin &&
            url.pathname === path &&
            !previous.includes(value)
          );
        });
        if (match) {
          link = match;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  if (!link) throw new Error("Expected an account link in Mailpit.");
  return link;
}

function expireResetLinks() {
  const project = process.env.HATCHLANE_TEST_PROJECT ?? "";
  if (!/^hatchlane-test-[a-z0-9]{8}$/.test(project)) {
    throw new Error(
      "Password reset expiry tests require a disposable Compose project.",
    );
  }
  execFileSync("docker", [
    "compose",
    "-p",
    project,
    "exec",
    "-T",
    "db",
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "hatchlane_bootstrap",
    "-d",
    "hatchlane",
    "-c",
    "UPDATE hatchlane.verification SET \"expiresAt\" = now() - interval '1 second' WHERE value = (SELECT id FROM hatchlane.\"user\" WHERE email = 'admin@example.test')",
  ]);
}

function recreateWithoutMapSource() {
  const project = process.env.HATCHLANE_TEST_PROJECT ?? "";
  const folder = process.env.HATCHLANE_MAP_SOURCE_DIR ?? "";
  const suffix = /^hatchlane-test-([a-z0-9]{8})$/.exec(project)?.[1];
  if (
    !suffix ||
    basename(folder) !== "maps" ||
    basename(dirname(folder)).toLowerCase() !== `test.${suffix}`
  ) {
    throw new Error(
      "Map persistence checks require a disposable Compose archive.",
    );
  }
  renameSync(
    join(folder, "region.pmtiles"),
    join(folder, "region-disabled.pmtiles"),
  );
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      "/dev/null",
      "-p",
      project,
      "-f",
      "compose.yaml",
      "-f",
      "compose.test.yaml",
      "up",
      "-d",
      "--no-deps",
      "--force-recreate",
      "--wait",
      "--wait-timeout",
      "30",
      "app",
    ],
    { stdio: "pipe", timeout: 35_000 },
  );
}

test("onboard an Admin, invite a member to two sites, and recover the Admin account", async ({
  page,
  browser,
  request,
}) => {
  const withMap = Boolean(process.env.HATCHLANE_TEST_MAP_SOURCE);
  const testPosition =
    process.env.HATCHLANE_TEST_INDIA_MAP === "1"
      ? { latitude: 28.6139, longitude: 77.209 }
      : { latitude: 12.9716, longitude: 77.5946 };
  const movedPosition = {
    latitude: testPosition.latitude,
    longitude: Number((testPosition.longitude + 0.005).toFixed(6)),
  };
  const remotePosition =
    process.env.HATCHLANE_TEST_INDIA_MAP === "1"
      ? { latitude: 13.0827, longitude: 80.2707 }
      : { latitude: 12.9352, longitude: 77.6245 };
  let archivePath: string | undefined;
  let sourcePath: string | undefined;
  let center: { latitude: number; longitude: number } | undefined;
  const externalRequests: string[] = [];
  if (withMap) {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(testPosition);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) await route.continue();
      else {
        externalRequests.push(url.origin);
        await route.abort();
      }
    });
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (response.status() === 206 && path.includes("/map/source/"))
        sourcePath ??= path;
      if (response.status() === 206 && path.includes("/map/archive/"))
        archivePath ??= path;
    });
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("Site map"))
        console.error(message.text());
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Sign in to Hatchlane" }),
  ).toBeVisible();
  expect((await page.request.get("/api/sites")).status()).toBe(401);
  expect(
    (
      await send(page.request, "/api/auth/sign-up/email", {
        ...member,
        name: "Test Member",
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", { data: admin })
    ).status(),
  ).toBe(403);
  await signIn(page, { ...admin, password: "incorrect-password" });
  await expect(
    page.getByRole("alert").filter({ hasText: /email or password/i }),
  ).toBeVisible();
  await signIn(page, admin);

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Test Administrator" }),
  ).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => element.scrollWidth),
  ).toBe(390);
  expect((await page.request.get("/api/sites")).status()).toBe(403);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your first site" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Create your first site" }),
  ).toBeVisible();
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Kolkata");
  await page.getByLabel("Site name").fill("North Yard");
  await page.getByLabel("Time zone").selectOption("UTC");
  await page
    .getByLabel("Description (optional)")
    .fill("First local test site.");
  await page.getByRole("button", { name: "Save site and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Set site location" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Set site location" }),
  ).toBeVisible();
  expect(
    (await send(page.request, "/api/onboarding/complete", {})).status(),
  ).toBe(409);
  const repeated = await send(page.request, "/api/onboarding/site", {
    name: "Duplicate",
    timeZone: "UTC",
    description: "",
  });
  expect(repeated.ok()).toBe(true);
  const { siteId: firstSiteId } = (await repeated.json()) as { siteId: string };
  const expectedExplorer = `/workspace/${firstSiteId}/explorer`;
  if (withMap) {
    const picker = page.getByRole("region", {
      name: "Choose site center on the map",
    });
    await expect(picker).toHaveAttribute("data-map-status", "ready", {
      timeout: 15_000,
    });
    await expect(page.getByLabel("Radius (km)")).toHaveValue("1");
    await expect(page.getByLabel("Latitude")).toHaveValue(
      String(testPosition.latitude),
    );
    await expect(page.getByLabel("Longitude")).toHaveValue(
      String(testPosition.longitude),
    );
    await expect(
      page.getByText("Map coverage is approximately 3.14 km²."),
    ).toBeVisible();
    const preview = picker.locator("canvas");
    const wheelIsHandled = (modifier: "ctrlKey" | "metaKey" | null) =>
      preview.evaluate((canvas, key) => {
        const { left, top, width, height } = canvas.getBoundingClientRect();
        const event = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: left + width / 2,
          clientY: top + height / 2,
          deltaY: -120,
          ...(key ? { [key]: true } : {}),
        });
        return !canvas.dispatchEvent(event);
      }, modifier);
    expect(await wheelIsHandled(null)).toBe(false);
    const beforeWheelZoom = await preview.screenshot();
    expect(await wheelIsHandled("ctrlKey")).toBe(true);
    await expect
      .poll(async () => beforeWheelZoom.equals(await preview.screenshot()))
      .toBe(false);
    expect(await wheelIsHandled("metaKey")).toBe(true);
    const beforeZoom = await preview.screenshot();
    await picker.getByRole("button", { name: "Zoom in" }).click();
    await expect
      .poll(async () => beforeZoom.equals(await preview.screenshot()))
      .toBe(false);
    await picker.getByRole("button", { name: "Zoom out" }).click();
    await page.context().setGeolocation(movedPosition);
    await picker.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByLabel("Longitude")).toHaveValue(
      String(movedPosition.longitude),
    );
    center = {
      latitude: Number(await page.getByLabel("Latitude").inputValue()),
      longitude: Number(await page.getByLabel("Longitude").inputValue()),
    };
    await preview.click({ position: { x: 110, y: 110 } });
    await expect(page.getByLabel("Longitude")).not.toHaveValue(
      String(movedPosition.longitude),
    );
    const chosen = await dragSiteCenter(page, page);
    await page.getByLabel("Radius (km)").fill("2.5");
    await expect(
      page.getByText("Map coverage is approximately 19.63 km²."),
    ).toBeVisible();
    const save = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/api/onboarding/map" &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Save site map" }).click();
    expect((await save).postDataJSON().location).toMatchObject({
      ...chosen,
      radiusKm: 2.5,
    });
  } else {
    await expect(page.getByText(/install a regional map/)).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Invite people" }),
  ).toBeVisible();
  expect(
    (
      await send(page.request, "/api/onboarding/map", { location: null })
    ).status(),
  ).toBe(409);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Invite people" }),
  ).toBeVisible();
  await invite(page, member.email);
  const firstInvite = await emailLink(request, member.email, "/invite");
  await page.getByRole("button", { name: "Open Site Explorer" }).click();
  await expect(page).toHaveURL(expectedExplorer);
  await expect(
    page.getByRole("heading", { name: "Site Explorer" }),
  ).toBeVisible();
  if (withMap) {
    await expect(page.getByText("2.5 km radius")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Saved site map" }),
    ).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
    const savedMap = page.getByRole("region", { name: "Saved site map" });
    await page.context().setGeolocation({ latitude: 20, longitude: 80 });
    await savedMap
      .getByRole("button", { name: "Use current location" })
      .click();
    await expect(
      page.getByText("Your location is outside this saved site map."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Map settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Site map settings" }),
    ).toBeVisible();
    await expect(page.getByLabel("Radius (km)")).toHaveValue("2.5");
    await page.getByRole("button", { name: "Cancel" }).click();
    if (!archivePath || !sourcePath)
      throw new Error("Expected local map range requests.");
    const archivePattern = `**${archivePath}`;
    await page.route(archivePattern, (route) => route.fulfill({ status: 503 }));
    await page.reload();
    const retryMap = page.getByRole("button", { name: "Retry map" });
    await expect(retryMap).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find a manhole" }),
    ).toBeEnabled();
    await page.unroute(archivePattern);
    await retryMap.click();
    await expect(savedMap).toHaveAttribute("data-map-status", "ready");
    await expect(retryMap).toHaveCount(0);
    const slice = await page.request.get(archivePath, {
      headers: { Range: "bytes=0-6" },
    });
    expect(slice.status()).toBe(206);
    expect(await slice.text()).toBe("PMTiles");
    expect(slice.headers()["cache-control"]).toContain("no-store");
    const invalidRange = await page.request.get(archivePath, {
      headers: { Range: "bytes=999999999-" },
    });
    expect(invalidRange.status()).toBe(416);
    expect(invalidRange.headers()["content-range"]).toMatch(/^bytes \*\/\d+$/);
    expect((await request.get(archivePath)).status()).toBe(401);
    expect(externalRequests).toEqual([]);
  } else {
    await expect(
      page.getByRole("heading", { name: "No site map yet" }),
    ).toBeVisible();
  }
  expect(await (await page.request.get("/api/sites")).json()).toHaveLength(1);

  const assetsPath = `/api/sites/${firstSiteId}/assets`;
  const addAsset = page.getByRole("button", { name: "Add manhole" });
  await addAsset.click();
  const addManholeForm = page.getByRole("form", { name: "Add manhole" });
  await page.getByLabel("Manhole ID").fill("MH-001");
  await page.getByLabel("Manhole name").fill("North entrance");
  await page.getByLabel("Location note (optional)").fill("Next to the gate.");
  if (withMap) {
    if (!center)
      throw new Error("Expected a saved center for asset placement.");
    const map = page.getByRole("region", { name: "Saved site map" });
    const locate = addManholeForm.getByRole("button", {
      name: "Get current location",
    });
    await expect(
      map.getByRole("button", { name: /current location/i }),
    ).toHaveCount(0);
    await page.context().setGeolocation({ latitude: 20, longitude: 80 });
    await locate.click();
    await expect(
      addManholeForm.getByText("Your location is outside this saved site map."),
    ).toBeVisible();
    await page.context().setGeolocation({ ...center, accuracy: 4 });
    await locate.click();
    await expect(
      addManholeForm.getByText(/estimated accuracy ±4 m/),
    ).toBeVisible();
    const draft = map.getByRole("button", { name: "Draft manhole pin" });
    await draft.press("ArrowRight");
    await expect(page.getByText(/estimated accuracy ±4 m/)).toHaveCount(0);
  } else {
    await expect(
      page.getByText("You can save this manhole without a pin."),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: withMap ? "Save & lock pin" : "Save manhole" })
    .click();
  await expect(page.getByText("Manhole MH-001 saved.")).toHaveClass("sr-only");
  const assetDetails = page.getByRole("complementary", {
    name: "Manhole details",
  });
  await expect(assetDetails.getByText("Next to the gate.")).toBeVisible();
  const [registered] = (await (
    await page.request.get(assetsPath)
  ).json()) as Asset[];
  expect(registered.printedId).toBe("MH-001");
  expect(Boolean(registered.pin)).toBe(withMap);
  expect(registered.pin?.gps).toBeUndefined();
  const detailsPath = `${assetsPath}/${registered.id}`;
  const outsidePin = { latitude: 0, longitude: 0 };
  expect(
    (
      await send(page.request, assetsPath, {
        ...registered,
        id: crypto.randomUUID(),
        printedId: "OUTSIDE",
        pin: outsidePin,
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await send(page.request, `${detailsPath}/pin`, {
        pin: outsidePin,
        pinRevision: registered.pinRevision,
      })
    ).status(),
  ).toBe(409);
  expect(await (await page.request.get(detailsPath)).json()).toEqual(
    registered,
  );
  expect((await request.get(assetsPath)).status()).toBe(401);
  expect((await request.get(detailsPath)).status()).toBe(401);
  const retry = await send(page.request, assetsPath, registered);
  expect(retry.ok()).toBe(true);
  expect(await retry.json()).toEqual(registered);
  expect(
    (
      await send(page.request, assetsPath, {
        ...registered,
        printedId: "mh-001",
        id: crypto.randomUUID(),
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await send(page.request, detailsPath, {
        ...registered,
        pin: { latitude: 100, longitude: 0 },
      })
    ).status(),
  ).toBe(400);
  if (withMap) {
    const map = page.getByRole("region", { name: "Saved site map" });
    const marker = map.getByRole("button", { name: "Open manhole MH-001" });
    const draft = map.getByRole("button", { name: "Draft manhole pin" });
    await expect(draft).toHaveCount(0);
    await expect(assetDetails.getByText("Pin locked")).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await marker.click();
    await assetDetails.getByRole("button", { name: "Unlock pin" }).click();
    const movePanel = page.getByRole("complementary", {
      name: "Manhole panel",
    });
    const locate = movePanel.getByRole("button", {
      name: "Get current location",
    });
    await expect(locate).toBeEnabled();
    await expect(
      map.getByRole("button", { name: /current location/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Move manhole pin" }),
    ).toBeFocused();
    await draft.press("ArrowRight");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await (await page.request.get(detailsPath)).json()).toEqual(
      registered,
    );
    await assetDetails.getByRole("button", { name: "Unlock pin" }).click();
    await draft.hover();
    const position = await draft.boundingBox();
    if (!position) throw new Error("Expected a visible draft pin.");
    const x = position.x + position.width / 2;
    const y = position.y + position.height / 2;
    const coordinates = page.getByText(/^Pin at /);
    const previous = await coordinates.textContent();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 24, y + 6, { steps: 6 });
    await page.mouse.up();
    await expect(coordinates).not.toHaveText(previous ?? "");
    const { promise: pendingLocation, resolve: releaseLocationSave } =
      Promise.withResolvers<void>();
    await page.route(
      `**${detailsPath}/pin`,
      async (route) => {
        await pendingLocation;
        await route.continue();
      },
      { times: 1 },
    );
    const submittedCoordinates = await coordinates.textContent();
    try {
      await page.getByRole("button", { name: "Save & lock pin" }).click();
      await expect(locate).toBeDisabled();
      await expect(draft).toBeDisabled();
      await map
        .locator("canvas")
        .dispatchEvent("click", { clientX: x + 40, clientY: y + 20 });
      await expect(coordinates).toHaveText(submittedCoordinates ?? "");
    } finally {
      releaseLocationSave();
    }
    await expect(assetDetails.getByText("Pin locked")).toBeVisible();
    const moved = (await (await page.request.get(detailsPath)).json()) as Asset;
    expect(moved.pinRevision).toBe(registered.pinRevision + 1);
    expect(moved.pin).not.toEqual(registered.pin);
    const stale = { pin: registered.pin, pinRevision: registered.pinRevision };
    expect(
      (await send(page.request, `${detailsPath}/pin`, stale)).status(),
    ).toBe(409);
    expect(
      (
        await send(page.request, detailsPath, { ...registered, pin: null })
      ).status(),
    ).toBe(409);
  }
  const beforeEdit = (await (
    await page.request.get(detailsPath)
  ).json()) as Asset;
  await assetDetails.getByRole("button", { name: "Edit manhole" }).click();
  await expect(page.getByLabel("Manhole ID")).toHaveValue("MH-001");
  await page.getByLabel("Manhole name").fill("North entrance manhole");
  await page.getByRole("button", { name: "Save manhole" }).click();
  await expect(
    assetDetails.getByRole("heading", { name: "North entrance manhole" }),
  ).toBeVisible();
  const edited = (await (await page.request.get(detailsPath)).json()) as Asset;
  expect(edited).toEqual({ ...beforeEdit, name: "North entrance manhole" });

  const locksPath = `${detailsPath}/locks`;
  await assetDetails
    .getByRole("button", { name: "Assign lock to Door 1" })
    .click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "Scan QR code" }).click();
  await expect(page.getByText(/The camera is unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Type the lock ID" }).click();
  await page.getByLabel("Lock ID").fill("sl-1042");
  await page.getByLabel("Description (optional)").fill("Outer cover lock");
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(assetDetails.getByText("Outer cover lock")).toBeVisible();
  await assetDetails
    .getByRole("button", { name: "Assign lock to Door 2" })
    .click();
  await page.getByLabel("Lock ID").fill("SL-1042");
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(page.getByText("This lock is already assigned.")).toBeVisible();
  const concurrentLock = { door: 2, serial: "SL-1044" };
  expect((await send(page.request, locksPath, concurrentLock)).ok()).toBe(true);
  await page.getByLabel("Lock ID").fill("SL-1043");
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(
    page.getByText("This door already has a lock assigned."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    assetDetails.getByText("SL-1044", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await send(page.request, `${locksPath}/remove`, {
        ...concurrentLock,
        serial: "SL-OLD",
      })
    ).status(),
  ).toBe(409);
  await assetDetails
    .getByRole("button", { name: "Door 2 lock actions" })
    .click();
  await page.getByRole("menuitem", { name: "Remove assignment" }).click();
  await expect(
    page.getByRole("heading", { name: "Remove lock assignment" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Remove assignment" }).click();
  await expect(assetDetails.getByText("SL-1044", { exact: true })).toHaveCount(
    0,
  );
  await assetDetails
    .getByRole("button", { name: "Assign lock to Door 2" })
    .click();

  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const label = new Image();
      label.src = "/samples/smart-lock-door-2.png";
      await label.decode();
      const canvas = document.createElement("canvas");
      canvas.width = label.width;
      canvas.height = label.height;
      const context = canvas.getContext("2d");
      const stream = canvas.captureStream(12);
      const draw = window.setInterval(() => {
        if (!stream.active) window.clearInterval(draw);
        else context?.drawImage(label, 0, 0);
      }, 100);
      return stream;
    };
  });
  await page.getByRole("button", { name: "Scan QR code" }).click();
  await expect(page.getByLabel("Lock ID")).toHaveValue("SL-1043");
  expect(
    (await (await page.request.get(locksPath)).json()) as ManholeLock[],
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(
    assetDetails.getByText("SL-1043", { exact: true }),
  ).toBeVisible();
  await expect(
    assetDetails.getByRole("heading", { name: "Outer solid cover" }),
  ).toBeVisible();
  await expect(
    assetDetails.getByRole("heading", { name: "Inner mesh guard" }),
  ).toBeVisible();
  await expect(assetDetails.getByText("Assigned", { exact: true })).toHaveCount(
    2,
  );
  await expect(assetDetails).not.toContainText(
    "Lock SL-1043 assigned to Door 2.",
  );
  await page.getByRole("button", { name: "Find a manhole" }).click();
  await expect(
    page.getByRole("complementary", { name: "Manhole panel" }),
  ).not.toContainText("Lock SL-1043 assigned to Door 2.");

  if (withMap && center) {
    await page.getByRole("button", { name: "Add manhole" }).click();
    await page.getByLabel("Manhole ID").fill("MH-02");
    await page.getByLabel("Manhole name").fill("South entrance");
    await page.getByRole("button", { name: "Save without a pin" }).click();
    const find = page.getByRole("button", { name: "Find a manhole" });
    const unpinned = page.getByRole("button", {
      name: /South entrance MH-02 No map pin/,
    });
    await expect(find).toContainText("1 without a pin");
    await expect(
      page.getByRole("button", { name: "Open manhole MH-02" }),
    ).toHaveCount(0);
    await find.click();
    await page.getByRole("searchbox").fill("MH-001");
    await page
      .getByRole("button", { name: /North entrance manhole MH-001/ })
      .click();
    await find.click();
    await unpinned.click();
    await expect(
      assetDetails.getByRole("heading", { name: "South entrance" }),
    ).toBeVisible();
    await expect(assetDetails.getByText("No pin saved")).toBeVisible();
    await assetDetails.getByRole("button", { name: "Place pin" }).click();
    await page
      .context()
      .setGeolocation({ ...center, latitude: center.latitude + 0.001 });
    await page.getByRole("button", { name: "Get current location" }).click();
    await page.getByRole("button", { name: "Save & lock pin" }).click();
    await expect(
      page.getByRole("button", { name: "Open manhole MH-02" }),
    ).toHaveCount(1);
    await expect(find).not.toContainText("without a pin");
  }

  expect((await request.get(locksPath)).status()).toBe(401);
  expect(
    (
      await send(page.request, locksPath, {
        door: 1,
        serial: "SL-1044",
        description: "",
      })
    ).status(),
  ).toBe(409);

  const memberContext = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });
  const memberPage = await memberContext.newPage();
  await memberPage.goto(firstInvite);
  await expect(
    memberPage.getByRole("heading", { name: "Join North Yard" }),
  ).toBeVisible();
  await memberPage.getByLabel("Full name").fill("Test Member");
  await memberPage.getByLabel("New password").fill(member.password);
  await memberPage.getByLabel("Confirm password").fill(member.password);
  await memberPage
    .getByRole("button", { name: "Set password and join site" })
    .click();
  await memberPage.getByRole("link", { name: "Continue to sign in" }).click();
  await signIn(memberPage, member);
  await expect(
    memberPage.getByRole("heading", { name: "North Yard" }),
  ).toBeVisible();
  await expect(memberPage.getByText("UTC", { exact: true })).toBeVisible();
  const firstSite = new URL(memberPage.url()).pathname;
  await memberPage.goto(expectedExplorer);
  await memberPage.reload();
  await memberPage.getByRole("button", { name: "Find a manhole" }).click();
  const assetSearch = memberPage.getByRole("searchbox", {
    name: "Search by manhole ID or name",
  });
  await assetSearch.fill("missing");
  await expect(
    memberPage.getByText("No manholes match your search."),
  ).toBeVisible();
  await assetSearch.fill("mh-001");
  const memberAsset = memberPage.getByRole("button", {
    name: /North entrance manhole MH-001/,
  });
  await expect(memberAsset).toBeVisible();
  await assetSearch.fill("entrance");
  await memberAsset.click();
  const memberDetails = memberPage.getByRole("complementary", {
    name: "Manhole details",
  });
  await expect(memberDetails.getByText("Next to the gate.")).toBeVisible();
  await expect(
    memberDetails.getByRole("button", { name: "Edit manhole" }),
  ).toHaveCount(0);
  await expect(
    memberDetails.getByText("SL-1042", { exact: true }),
  ).toBeVisible();
  await expect(
    memberDetails.getByText("SL-1043", { exact: true }),
  ).toBeVisible();
  await expect(
    memberDetails.getByRole("button", { name: "Unlock pin" }),
  ).toHaveCount(0);
  await memberDetails.getByRole("button", { name: "Close panel" }).click();
  await expect(
    memberPage.getByRole("button", { name: "Add manhole" }),
  ).toHaveCount(0);
  expect((await memberPage.request.get(detailsPath)).ok()).toBe(true);
  expect(
    (await send(memberPage.request, assetsPath, registered)).status(),
  ).toBe(403);
  expect((await send(memberPage.request, detailsPath, edited)).status()).toBe(
    403,
  );
  expect(
    (
      await send(memberPage.request, `${detailsPath}/pin`, {
        pin: null,
        pinRevision: edited.pinRevision,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await send(memberPage.request, locksPath, {
        door: 2,
        serial: "SL-1044",
        description: "",
      })
    ).status(),
  ).toBe(403);
  await memberPage.setViewportSize({ width: 1280, height: 900 });
  if (archivePath && sourcePath) {
    expect(
      (
        await memberPage.request.get(archivePath, {
          headers: { Range: "bytes=0-6" },
        })
      ).status(),
    ).toBe(206);
    expect((await memberPage.request.get(sourcePath)).status()).toBe(403);
    await memberPage.goto(expectedExplorer);
    await expect(
      memberPage.getByRole("heading", { name: "Site Explorer" }),
    ).toBeVisible();
    await expect(
      memberPage.getByRole("button", { name: "Map settings" }),
    ).toHaveCount(0);
    if (!center) throw new Error("Expected the regional map center.");
    const selection = {
      ...center,
      radiusKm: 3,
      sourceRevision: sourcePath.split("/").at(-1),
    };
    const updatePath = `/api/sites/${firstSiteId}/map`;
    expect(
      (await send(memberPage.request, updatePath, selection)).status(),
    ).toBe(403);
    await page.getByRole("button", { name: "Map settings" }).click();
    const updatedCenter = await dragSiteCenter(page, page);
    await page.getByLabel("Radius (km)").fill("3");
    const replacement = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === updatePath &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save site map" }).click();
    const replacementMap = await replacement;
    expect(replacementMap.status(), await replacementMap.text()).toBe(200);
    expect(replacementMap.request().postDataJSON()).toMatchObject({
      ...updatedCenter,
      radiusKm: 3,
    });
    expect(
      (
        await page.request.get(archivePath, { headers: { Range: "bytes=0-6" } })
      ).status(),
    ).toBe(404);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(expectedExplorer);
    await expect(page.getByText("3 km radius")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Saved site map" }),
    ).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
    await page.getByRole("button", { name: "Map settings" }).click();
    await expect(page.getByLabel("Latitude")).toHaveValue(
      String(updatedCenter.latitude),
    );
    await expect(page.getByLabel("Longitude")).toHaveValue(
      String(updatedCenter.longitude),
    );
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(externalRequests).toEqual([]);
  }
  await memberPage.getByRole("button", { name: /Switch site/ }).click();
  await expect(
    memberPage.getByRole("menuitem", { name: "Create site" }),
  ).toHaveCount(0);
  await memberPage.goto(firstInvite);
  await expect(
    memberPage.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const siteSwitcher = page.getByRole("button", { name: /Switch site/ });
  const createSiteEntry = page.getByRole("menuitem", { name: "Create site" });
  const createSiteDialog = page.getByRole("dialog", { name: "Create site" });
  const continueToLocation = createSiteDialog.getByRole("button", {
    name: "Continue to site location",
  });
  await siteSwitcher.click();
  await createSiteEntry.click();
  await createSiteDialog.getByLabel("Site name").fill("Unsaved Yard");
  await page.mouse.click(4, 4);
  await page.keyboard.press("Escape");
  await expect(createSiteDialog).toBeVisible();
  await expect(createSiteDialog.getByLabel("Site name")).toHaveValue(
    "Unsaved Yard",
  );
  await createSiteDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(createSiteDialog).toBeHidden();
  await expect(siteSwitcher).toBeFocused();
  await siteSwitcher.click();
  await createSiteEntry.click();
  await expect(createSiteDialog.getByLabel("Site name")).toHaveValue("");
  await createSiteDialog.getByLabel("Site name").fill("Unsaved location draft");
  await continueToLocation.click();
  await expect(
    createSiteDialog.getByRole("heading", { name: "Set site location" }),
  ).toBeVisible();
  await createSiteDialog.getByRole("button", { name: "Close" }).click();
  await expect(createSiteDialog).toBeHidden();
  const sitesBeforeSetup = await page.request.get("/api/sites");
  expect(await sitesBeforeSetup.json()).toHaveLength(1);
  await siteSwitcher.click();
  await createSiteEntry.click();
  await expect(createSiteDialog.getByLabel("Time zone")).toHaveValue(
    "Asia/Kolkata",
  );
  await createSiteDialog.getByLabel("Site name").fill("South Yard");
  if (withMap) await page.context().setGeolocation(testPosition);
  await continueToLocation.click();
  if (withMap && sourcePath) {
    const revision = sourcePath.split("/").at(-1);
    const draftSourcePath = `/api/map/source/${revision}`;
    expect((await memberPage.request.get(draftSourcePath)).status()).toBe(403);
    expect((await request.get(draftSourcePath)).status()).toBe(401);
    const failedSiteId = crypto.randomUUID();
    const invalidMap = await send(page.request, "/api/sites", {
      id: failedSiteId,
      name: "Failed map draft",
      timeZone: "Asia/Kolkata",
      location: { ...testPosition, radiusKm: 1, sourceRevision: "0-0" },
    });
    expect(invalidMap.status()).toBe(409);
    expect(
      (await page.request.get(`/api/sites/${failedSiteId}`)).status(),
    ).toBe(404);
    const picker = createSiteDialog.getByRole("region", {
      name: "Choose site center on the map",
    });
    await expect(picker).toHaveAttribute("data-map-status", "ready", {
      timeout: 15_000,
    });
    const latitude = createSiteDialog.getByLabel("Latitude");
    const longitude = createSiteDialog.getByLabel("Longitude");
    await expect(latitude).toHaveValue(String(testPosition.latitude));
    await expect(longitude).toHaveValue(String(testPosition.longitude));
    await expect(createSiteDialog.getByLabel("Radius (km)")).toHaveValue("1");
    await createSiteDialog
      .getByRole("button", { name: "Show map region" })
      .click();

    await dragSiteCenter(page, createSiteDialog);

    await latitude.fill("0");
    await expect(
      createSiteDialog.getByText(
        "The circle extends outside the installed map.",
        { exact: false },
      ),
    ).toBeVisible();
    const saveMap = createSiteDialog.getByRole("button", {
      name: "Save site map",
    });
    await expect(saveMap).toBeDisabled();
    await latitude.fill(String(remotePosition.latitude));
    await longitude.fill(String(remotePosition.longitude));
    const chosen = await dragSiteCenter(page, createSiteDialog);
    expect(Math.abs(chosen.latitude - remotePosition.latitude)).toBeLessThan(
      0.02,
    );
    expect(Math.abs(chosen.longitude - remotePosition.longitude)).toBeLessThan(
      0.02,
    );
    await createSiteDialog.getByLabel("Radius (km)").fill("1.5");
    await expect(
      createSiteDialog.getByText("Map coverage is approximately 7.07 km²."),
    ).toBeVisible();
    const creation = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/sites" &&
        response.request().method() === "POST",
    );
    await saveMap.click();
    const created = await creation;
    const savedSiteRequest = created.request().postDataJSON();
    expect(savedSiteRequest.location).toEqual({
      ...chosen,
      radiusKm: 1.5,
      sourceRevision: revision,
    });
    expect(created.ok(), await created.text()).toBe(true);
    const sameSite = await send(page.request, "/api/sites", savedSiteRequest);
    expect(sameSite.ok(), await sameSite.text()).toBe(true);
    expect(await sameSite.json()).toEqual(await created.json());
    for (const location of [
      null,
      { ...savedSiteRequest.location, radiusKm: 2 },
    ]) {
      const changedRequest = await send(page.request, "/api/sites", {
        ...savedSiteRequest,
        location,
      });
      expect(changedRequest.status(), await changedRequest.text()).toBe(409);
    }
  } else {
    await createSiteDialog
      .getByRole("button", { name: "Skip for now" })
      .click();
  }
  await expect(
    createSiteDialog.getByRole("heading", { name: "Invite people" }),
  ).toBeVisible();
  const secondInviteResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/invitations") &&
      response.ok(),
  );
  await createSiteDialog.getByLabel("Member email address").fill(member.email);
  await createSiteDialog
    .getByRole("button", { name: "Send invitation" })
    .click();
  await secondInviteResponse;
  await expect(
    createSiteDialog.getByText(`Invitation sent to ${member.email}.`),
  ).toBeVisible();
  const secondArchiveResponse = withMap
    ? page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.includes("/map/archive/") &&
          response.status() === 206,
      )
    : null;
  await createSiteDialog
    .getByRole("button", { name: "Open Site Explorer" })
    .click();
  await expect(page).toHaveURL(/\/workspace\/[^/]+\/explorer$/);
  await expect(
    page.getByRole("heading", { name: "Site Explorer" }),
  ).toBeVisible();
  const secondSite = new URL(page.url()).pathname.replace(/\/explorer$/, "");
  const secondArchive = secondArchiveResponse
    ? new URL((await secondArchiveResponse).url()).pathname
    : undefined;
  if (secondArchive && sourcePath) {
    await expect(page.getByText("1.5 km radius")).toBeVisible();
    recreateWithoutMapSource();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Saved site map" }),
    ).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
    expect((await page.request.get(sourcePath)).status()).toBe(404);
    expect(externalRequests).toEqual([]);
  }
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { name: "South Yard" })).toBeVisible();
  await expect(page.getByText("Asia/Kolkata", { exact: true })).toBeVisible();
  expect((await memberPage.goto(secondSite))?.status()).toBe(404);
  expect(
    (
      await memberPage.request.get(
        secondSite.replace("/workspace/", "/api/sites/"),
      )
    ).status(),
  ).toBe(404);
  const otherAssetsPath = `${secondSite.replace("/workspace/", "/api/sites/")}/assets`;
  expect((await memberPage.goto(`${secondSite}/explorer`))?.status()).toBe(404);
  expect((await memberPage.request.get(otherAssetsPath)).status()).toBe(404);
  expect(
    (await page.request.get(`${otherAssetsPath}/${registered.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(`${otherAssetsPath}/${registered.id}/locks`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await send(page.request, `${otherAssetsPath}/${registered.id}`, edited)
    ).status(),
  ).toBe(404);
  const samePrintedId = { ...registered, id: crypto.randomUUID(), pin: null };
  expect((await send(page.request, otherAssetsPath, samePrintedId)).ok()).toBe(
    true,
  );
  expect(
    (
      await send(
        memberPage.request,
        `${firstSite.replace("/workspace/", "/api/sites/")}/invitations`,
        { email: "outsider@example.test" },
      )
    ).status(),
  ).toBe(403);
  const secondInvite = await emailLink(request, member.email, "/invite", [
    firstInvite,
  ]);
  await memberPage.goto(firstSite);
  const accountMenu = memberPage.getByRole("button", { name: /Account menu/ });
  await accountMenu.click();
  await memberPage.getByRole("menuitem", { name: "Settings" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "Account settings" }),
  ).toBeVisible();
  await expect(
    memberPage.getByRole("link", { name: "Reset password" }),
  ).toHaveAttribute("href", "/forgot-password");
  await accountMenu.click();
  await memberPage.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "Sign in to Hatchlane" }),
  ).toBeVisible();
  await memberPage.goto(secondInvite);
  await memberPage.getByRole("link", { name: "Sign in to accept" }).click();
  await signIn(memberPage, member);
  await memberPage.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "South Yard" }),
  ).toBeVisible();
  await memberPage.getByRole("button", { name: /Switch site/ }).click();
  await expect(
    memberPage.getByRole("menuitem", { name: "South Yard" }),
  ).toHaveAttribute("aria-current", "page");
  await memberPage.getByRole("menuitem", { name: "North Yard" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "North Yard" }),
  ).toBeVisible();
  await expect(
    memberPage.getByRole("button", { name: "Delete site" }),
  ).toHaveCount(0);

  const secondAdmin = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  const secondAdminPage = await secondAdmin.newPage();
  await secondAdminPage.goto("/sign-in");
  await signIn(secondAdminPage, admin);
  await expect(secondAdminPage).toHaveURL(/\/workspace\//);

  const resetPage = await browser.newPage({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  await resetPage.goto("/sign-in");
  await resetPage.getByRole("link", { name: "Forgot password?" }).click();
  const recoveryForm = resetPage.locator("main").filter({
    has: resetPage.getByRole("heading", { name: "Forgot password" }),
  });
  await recoveryForm.getByLabel("Email address").fill(admin.email);
  const resetRequest = resetPage.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/request-password-reset",
    { timeout: 10_000 },
  );
  await resetPage.getByRole("button", { name: "Send reset link" }).click();
  const resetResponse = await resetRequest;
  expect(resetResponse.status(), await resetResponse.text()).toBe(200);
  await expect(resetPage.getByText("Check your email")).toBeVisible();
  const resetLink = await emailLink(request, admin.email, "/reset-password");
  const known = await send(
    resetPage.request,
    "/api/auth/request-password-reset",
    { email: admin.email },
  );
  const unknown = await send(
    resetPage.request,
    "/api/auth/request-password-reset",
    { email: "unknown@example.test" },
  );
  expect(known.ok()).toBe(true);
  expect(await unknown.json()).toEqual(await known.json());
  const toExpire = await emailLink(request, admin.email, "/reset-password", [
    resetLink,
  ]);
  expireResetLinks();
  const expired = await send(resetPage.request, "/api/auth/reset-password", {
    token: new URL(toExpire).searchParams.get("token"),
    password: replacement,
    confirmation: replacement,
  });
  expect(expired.status()).toBe(400);

  expect(
    (
      await send(resetPage.request, "/api/auth/request-password-reset", {
        email: admin.email,
      })
    ).ok(),
  ).toBe(true);
  const usable = await emailLink(request, admin.email, "/reset-password", [
    resetLink,
    toExpire,
  ]);
  await resetPage.goto(usable);
  await resetPage.getByLabel("New password").fill(replacement);
  await resetPage.getByLabel("Confirm password").fill(replacement);
  await resetPage.getByRole("button", { name: "Update password" }).click();
  await expect(resetPage.getByText("Password updated")).toBeVisible();
  expect((await page.request.get("/api/sites")).status()).toBe(401);
  expect((await secondAdmin.request.get("/api/sites")).status()).toBe(401);
  const reused = await send(resetPage.request, "/api/auth/reset-password", {
    token: new URL(usable).searchParams.get("token"),
    password: replacement,
    confirmation: replacement,
  });
  expect(reused.status()).toBe(400);
  await resetPage.getByRole("link", { name: "Continue to sign in" }).click();
  await signIn(resetPage, { ...admin, password: replacement });
  await expect(resetPage).toHaveURL(/\/workspace\//);

  const deleteFirst = `/api/sites/${firstSiteId}/delete`;
  expect(
    (
      await send(memberPage.request, deleteFirst, { name: "North Yard" })
    ).status(),
  ).toBe(403);
  expect(
    (
      await send(resetPage.request, deleteFirst, {
        name: "South Yard",
        impact: {
          hasMap: false,
          manholes: 0,
          locks: 0,
          memberships: 0,
          invitations: 0,
        },
      })
    ).status(),
  ).toBe(409);
  await resetPage.goto(firstSite);
  const pendingMember = "pending@example.test";
  await invite(resetPage, pendingMember);
  const pendingInvite = await emailLink(request, pendingMember, "/invite");
  const deleteTrigger = resetPage.getByRole("button", {
    name: "Delete site",
    exact: true,
  });
  const deleteDialog = resetPage.getByRole("dialog", { name: "Delete site" });
  const confirm = deleteDialog.getByLabel("Type the site name to confirm");
  const permanentlyDelete = deleteDialog.getByRole("button", {
    name: "Permanently delete site",
  });
  await deleteTrigger.click();
  await expect(deleteDialog.getByText("Manholes and their pins")).toBeVisible();
  await expect(deleteDialog.getByText("Smart-lock assignments")).toBeVisible();
  if (withMap)
    await expect(
      deleteDialog.getByText("Saved site map and boundary"),
    ).toBeVisible();
  await expect(permanentlyDelete).toBeDisabled();
  await confirm.fill("South Yard");
  await expect(permanentlyDelete).toBeDisabled();
  await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(deleteDialog).toBeHidden();
  await deleteTrigger.click();
  await expect(confirm).toHaveValue("");
  await confirm.fill("North Yard");
  await permanentlyDelete.click();
  await expect(
    deleteDialog.getByText(
      "Site data changed. Review the updated counts and confirm again.",
    ),
  ).toBeVisible();
  await expect(confirm).toHaveValue("");
  await expect(
    deleteDialog
      .locator("dl > div")
      .filter({ hasText: "Site invitations" })
      .getByRole("definition"),
  ).toHaveText("2");
  await confirm.fill("North Yard");
  await permanentlyDelete.click();
  await expect(resetPage).toHaveURL(`${secondSite}/explorer`);
  expect((await resetPage.request.get(assetsPath)).status()).toBe(404);
  expect((await memberPage.goto(firstSite))?.status()).toBe(404);
  await memberPage.goto(secondSite);
  await expect(
    memberPage.getByRole("heading", { name: "South Yard" }),
  ).toBeVisible();
  await resetPage.goto(pendingInvite);
  await expect(
    resetPage.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  const reusedLock = await send(
    resetPage.request,
    `${otherAssetsPath}/${samePrintedId.id}/locks`,
    concurrentLock,
  );
  expect(reusedLock.ok(), await reusedLock.text()).toBe(true);

  await resetPage.goto(secondSite);
  await deleteTrigger.click();
  await confirm.fill("South Yard");
  await permanentlyDelete.click();
  await expect(
    resetPage.getByRole("heading", { name: "No sites yet" }),
  ).toBeVisible();
  if (secondArchive)
    expect((await resetPage.request.get(secondArchive)).status()).toBe(404);
  await memberPage.goto("/workspace");
  await expect(
    memberPage.getByRole("heading", { name: "No sites assigned" }),
  ).toBeVisible();
  await resetPage.getByRole("link", { name: "Create site" }).click();
  await expect(
    resetPage.getByRole("heading", { name: "Site details" }),
  ).toBeVisible();
  await resetPage.getByLabel("Site name").fill("Fresh Yard");
  await resetPage
    .getByRole("button", { name: "Continue to site location" })
    .click();
  await resetPage.getByRole("button", { name: "Skip for now" }).click();
  await resetPage.getByRole("button", { name: "Open Site Explorer" }).click();
  await expect(resetPage).toHaveURL(/\/workspace\/[^/]+\/explorer$/);
  await memberContext.close();
  await secondAdmin.close();
  await resetPage.close();
});
