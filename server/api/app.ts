import { Readable } from "node:stream";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type ZodType, z } from "zod";
import {
  assetCreation,
  assetId,
  assetUpdate,
  pinUpdate,
} from "../../lib/assets.ts";
import { doorAssignment, lockRemoval } from "../../lib/manhole-locks.ts";
import {
  activationFields,
  forgotFields,
  invitationFields,
  passwordFields,
  resetToken,
  signInFields,
  siteCreation,
  siteDeletion,
  siteFields,
  siteId,
} from "../../lib/schemas.ts";
import { mapSelection } from "../../lib/site-map.ts";
import { getAuth, getPublicOrigin, getViewer } from "../auth/auth.ts";
import { getPool } from "../db/pool.ts";
import {
  assignLock,
  createAsset,
  getSiteAsset,
  listSiteAssets,
  listSiteLocks,
  removeLock,
  updateAsset,
  updateAssetPin,
} from "../domain/assets.ts";
import { acceptInvitation, sendInvitation } from "../domain/invitations.ts";
import { openRegionalMap } from "../domain/map-source.ts";
import { Problem } from "../domain/problems.ts";
import {
  createWorkspaceSite,
  getMapBytes,
  getSiteMap,
  requireMapEditor,
  resolveOnboardingMap,
  saveSiteMap,
} from "../domain/site-maps.ts";
import {
  createOnboardingSite,
  deleteSite,
  finishOnboarding,
  getSite,
  listSites,
  needsOnboarding,
  startOnboarding,
} from "../domain/sites.ts";
import { archiveRange } from "./byte-range.ts";

export const api = new Hono().basePath("/api");

api.use("*", async (context, next) => {
  context.header("Cache-Control", "private, no-store");
  if (context.req.method === "POST") {
    if (context.req.header("origin") !== getPublicOrigin()) {
      throw new Problem(
        403,
        "Open Hatchlane from its configured site address.",
      );
    }
    const mediaType = context.req
      .header("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      throw new Problem(415, "Send this request as JSON.");
    }
    return bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ message: "The request is too large." }, 413),
    })(context, next);
  }
  await next();
});

api.onError((error, context) => {
  if (error instanceof Problem) {
    return context.json(
      { message: error.message, code: error.code },
      error.status,
    );
  }
  console.error("A Hatchlane request failed");
  return context.json(
    { message: "Hatchlane could not complete the request. Try again." },
    500,
  );
});

api.get("/health", async (context) => {
  try {
    await getPool().query("SELECT 1 FROM hatchlane.admin_onboarding LIMIT 0");
  } catch {
    return context.json({ status: "unavailable" }, 503);
  }
  return context.json({ status: "ok" });
});

async function input<T>(context: Context, schema: ZodType<T>): Promise<T> {
  const data = await context.req.json().catch(() => null);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Problem(400, parsed.error.issues[0].message);
  return parsed.data;
}

async function viewer(context: Context) {
  const user = await getViewer(context.req.raw.headers);
  if (!user) throw new Problem(401, "Sign in to continue.");
  return user;
}

async function workspaceViewer(context: Context) {
  const user = await viewer(context);
  if (await needsOnboarding(user))
    throw new Problem(403, "Complete onboarding to open the workspace.");
  return user;
}

function forwardAuth(context: Context, body: object) {
  const headers = new Headers(context.req.raw.headers);
  headers.delete("content-length");
  return getAuth().handler(
    new Request(context.req.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

const activationResetFields = passwordFields.safeExtend({ token: resetToken });
const inviteActivationFields = activationFields.safeExtend(
  invitationFields.shape,
);

api.post("/auth/sign-in/email", async (c) =>
  forwardAuth(c, await input(c, signInFields)),
);
api.post("/auth/sign-out", (c) => forwardAuth(c, {}));
api.post("/auth/request-password-reset", async (c) =>
  forwardAuth(c, await input(c, forgotFields)),
);
api.post("/auth/reset-password", async (c) => {
  const data = await input(c, activationResetFields);
  return forwardAuth(c, { token: data.token, newPassword: data.password });
});

api.post("/onboarding/start", async (c) => {
  await startOnboarding(await viewer(c));
  return c.json({ ok: true });
});

api.post("/onboarding/site", async (c) => {
  const user = await viewer(c);
  return c.json({
    siteId: await createOnboardingSite(user, await input(c, siteFields)),
  });
});

api.post("/onboarding/map", async (c) => {
  const user = await viewer(c);
  const data = await input(c, z.object({ location: mapSelection.nullable() }));
  await resolveOnboardingMap(user, data.location);
  return c.json({ ok: true });
});

api.post("/onboarding/complete", async (c) => {
  return c.json({ siteId: await finishOnboarding(await viewer(c)) });
});

api.get("/sites", async (c) =>
  c.json(await listSites(await workspaceViewer(c))),
);

async function workspaceSite(c: Context) {
  const user = await workspaceViewer(c);
  const site = await getSite(user, siteIdFromPath(c));
  if (!site) throw new Problem(404, "Site not found.");
  return { user, site };
}

api.get("/sites/:siteId", async (c) => {
  const { site } = await workspaceSite(c);
  return c.json(site);
});

api.post("/sites", async (c) => {
  const user = await workspaceViewer(c);
  return c.json({
    siteId: await createWorkspaceSite(
      user,
      await input(c, siteCreation.extend({ location: mapSelection.nullish() })),
    ),
  });
});

api.post("/sites/:siteId/delete", async (c) => {
  const { user, site } = await workspaceSite(c);
  if (user.role !== "admin" || site.role !== "admin")
    throw new Problem(403, "Site Administrator access is required.");
  const { name, impact } = await input(c, siteDeletion);
  await deleteSite(user, site.id, name, impact);
  return c.json({ ok: true });
});

function siteIdFromPath(c: Context) {
  const id = siteId.safeParse(c.req.param("siteId"));
  if (!id.success) throw new Problem(404, "Site not found.");
  return id.data;
}

function assetIdFromPath(c: Context) {
  const id = assetId.safeParse(c.req.param("assetId"));
  if (!id.success) throw new Problem(404, "Manhole not found.");
  return id.data;
}

api.get("/sites/:siteId/assets", async (c) => {
  const { site } = await workspaceSite(c);
  return c.json(await listSiteAssets(site.id));
});

api.get("/sites/:siteId/assets/:assetId", async (c) => {
  const { site } = await workspaceSite(c);
  return c.json(await getSiteAsset(site.id, assetIdFromPath(c)));
});

api.post("/sites/:siteId/assets", async (c) => {
  const { user, site } = await workspaceSite(c);
  return c.json(
    await createAsset(user, site.id, await input(c, assetCreation)),
  );
});

api.post("/sites/:siteId/assets/:assetId", async (c) => {
  const { user, site } = await workspaceSite(c);
  const id = assetIdFromPath(c);
  return c.json(
    await updateAsset(user, site.id, id, await input(c, assetUpdate)),
  );
});

api.post("/sites/:siteId/assets/:assetId/pin", async (c) => {
  const { user, site } = await workspaceSite(c);
  return c.json(
    await updateAssetPin(
      user,
      site.id,
      assetIdFromPath(c),
      await input(c, pinUpdate),
    ),
  );
});

api.get("/sites/:siteId/assets/:assetId/locks", async (c) => {
  const { site } = await workspaceSite(c);
  const id = assetIdFromPath(c);
  await getSiteAsset(site.id, id);
  return c.json(await listSiteLocks(site.id, id));
});

api.post("/sites/:siteId/assets/:assetId/locks", async (c) => {
  const { user, site } = await workspaceSite(c);
  return c.json(
    await assignLock(
      user,
      site.id,
      assetIdFromPath(c),
      await input(c, doorAssignment),
    ),
  );
});

api.post("/sites/:siteId/assets/:assetId/locks/remove", async (c) => {
  const { user, site } = await workspaceSite(c);
  return c.json(
    await removeLock(
      user,
      site.id,
      assetIdFromPath(c),
      await input(c, lockRemoval),
    ),
  );
});

async function regionalMapResponse(c: Context) {
  const source = await openRegionalMap();
  if (!source) throw new Problem(404, "Regional map not found.");
  if (source.revision !== c.req.param("revision")) {
    await source.file.close();
    throw new Problem(404, "Regional map not found.");
  }

  const range = archiveRange(source.size, c.req.header("range"));
  if (range.status === 416) {
    await source.file.close();
    return c.body(null, 416, range.headers);
  }
  const body = Readable.toWeb(
    source.file.createReadStream({ start: range.start, end: range.end }),
  );
  return c.body(
    body as ReadableStream<Uint8Array>,
    range.status,
    range.headers,
  );
}

api.get("/map/source/:revision", async (c) => {
  const user = await workspaceViewer(c);
  if (user.role !== "admin")
    throw new Problem(403, "Administrator access is required.");
  return regionalMapResponse(c);
});

api.get("/sites/:siteId/map/source/:revision", async (c) => {
  const user = await viewer(c);
  await requireMapEditor(user, siteIdFromPath(c));
  return regionalMapResponse(c);
});

api.get("/sites/:siteId/map/archive/:revision", async (c) => {
  const { site } = await workspaceSite(c);
  const id = site.id;
  const map = await getSiteMap(id);
  if (!map || map.revision !== c.req.param("revision"))
    throw new Problem(404, "Site map not found.");
  const range = archiveRange(map.size, c.req.header("range"));
  if (range.status === 416) return c.body(null, 416, range.headers);
  const bytes = await getMapBytes(
    id,
    map.revision,
    range.start,
    range.end - range.start + 1,
  );
  if (!bytes) throw new Problem(404, "Site map not found.");
  return c.body(new Uint8Array(bytes), range.status, range.headers);
});

api.post("/sites/:siteId/map", async (c) => {
  const user = await workspaceViewer(c);
  await saveSiteMap(user, siteIdFromPath(c), await input(c, mapSelection));
  return c.json({ ok: true });
});

api.post("/sites/:siteId/invitations", async (c) => {
  const user = await viewer(c);
  const id = siteId.safeParse(c.req.param("siteId"));
  if (!id.success) throw new Problem(404, "Site not found.");
  const data = await input(c, forgotFields);
  await sendInvitation(user, id.data, data.email);
  return c.json({ ok: true });
});

api.post("/invitations/accept", async (c) => {
  const user = await viewer(c);
  const data = await input(c, invitationFields);
  return c.json({ siteId: await acceptInvitation(data.token, user) });
});

api.post("/invitations/activate", async (c) => {
  const data = await input(c, inviteActivationFields);
  const user = await getViewer(c.req.raw.headers);
  const site = await acceptInvitation(data.token, user, {
    name: data.name,
    password: data.password,
  });
  return c.json({ siteId: site });
});
