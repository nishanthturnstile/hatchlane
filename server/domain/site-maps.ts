import { sql } from "kysely";
import type { SiteFields } from "../../lib/schemas.ts";
import {
  coverageBounds,
  type MapSelection,
  type SavedSiteMap,
} from "../../lib/site-map.ts";
import type { Viewer } from "../auth/auth.ts";
import { type Database, getDatabase } from "../db/database.ts";
import { prepareMap } from "./map-source.ts";
import { Problem } from "./problems.ts";
import {
  getOnboarding,
  getSite,
  insertSite,
  lockSiteAdministrator,
  requireAdministrator,
} from "./sites.ts";

export async function getSiteMap(siteId: string, db = getDatabase()) {
  const { rows } = await sql<SavedSiteMap & { size: number }>`
    SELECT latitude, longitude, radius_km AS "radiusKm", bounds, revision,
           octet_length(archive) AS size
    FROM site_map WHERE site_id = ${siteId}
  `.execute(db);
  return rows[0];
}

export async function getMapBytes(
  siteId: string,
  revision: string,
  start: number,
  length: number,
) {
  const { rows } = await sql<{ bytes: Buffer }>`
    SELECT substring(archive FROM ${start + 1} FOR ${length}) AS bytes
    FROM site_map WHERE site_id = ${siteId} AND revision = ${revision}
  `.execute(getDatabase());
  return rows[0]?.bytes;
}

export async function requireMapEditor(viewer: Viewer, siteId: string) {
  const site = await getSite(viewer, siteId);
  if (!site) throw new Problem(404, "Site not found.");
  if (viewer.role !== "admin" || site.role !== "admin")
    throw new Problem(403, "Site Administrator access is required.");
  const progress = await getOnboarding(viewer);
  if (
    !progress?.completedAt &&
    (progress?.siteId !== siteId || progress.mapResolvedAt)
  )
    throw new Problem(
      403,
      "This site location cannot be edited during onboarding.",
    );
}

async function saveArchive(
  db: Database,
  siteId: string,
  selection: MapSelection,
  bounds: ReturnType<typeof coverageBounds>,
  archive: Buffer,
) {
  await sql`
    INSERT INTO site_map (site_id, revision, latitude, longitude, radius_km, bounds, archive)
    VALUES (${siteId}, ${crypto.randomUUID()}, ${selection.latitude}, ${selection.longitude},
            ${selection.radiusKm}, ${JSON.stringify(bounds)}::jsonb, ${archive})
    ON CONFLICT (site_id) DO UPDATE SET
      revision = excluded.revision, latitude = excluded.latitude,
      longitude = excluded.longitude, radius_km = excluded.radius_km,
      bounds = excluded.bounds, archive = excluded.archive
  `.execute(db);
}

export async function createWorkspaceSite(
  viewer: Viewer,
  input: SiteFields & { id: string; location?: MapSelection | null },
) {
  if (viewer.role !== "admin")
    throw new Problem(403, "Administrator access is required.");
  const { id, location } = input;
  return getDatabase()
    .transaction()
    .execute(async (tx) => {
      await requireAdministrator(viewer, tx);
      if (!(await getOnboarding(viewer, tx))?.completedAt)
        throw new Problem(
          403,
          "Complete onboarding before creating more sites.",
        );

      const created = await insertSite(tx, viewer, input, id);
      if (!created) {
        const saved = await getSiteMap(id, tx);
        const mapMatches = location
          ? saved?.latitude === location.latitude &&
            saved.longitude === location.longitude &&
            saved.radiusKm === location.radiusKm
          : !saved;
        if (!mapMatches) {
          throw new Problem(
            409,
            "This site was already created with a different map. Reload the workspace and use Map settings to change it.",
          );
        }
        return id;
      }
      if (location) {
        const archive = await prepareMap(location, location.sourceRevision);
        await saveArchive(tx, id, location, coverageBounds(location), archive);
      }
      return id;
    });
}

export async function saveSiteMap(
  viewer: Viewer,
  siteId: string,
  selection: MapSelection,
) {
  await requireMapEditor(viewer, siteId);
  const bounds = coverageBounds(selection);
  const archive = await prepareMap(selection, selection.sourceRevision);
  await getDatabase()
    .transaction()
    .execute(async (tx) => {
      await lockSiteAdministrator(viewer, siteId, tx);
      if (!(await getOnboarding(viewer, tx))?.completedAt)
        throw new Problem(
          403,
          "Complete onboarding before editing this site map.",
        );
      await saveArchive(tx, siteId, selection, bounds, archive);
    });
}

export async function resolveOnboardingMap(
  viewer: Viewer,
  selection: MapSelection | null,
) {
  const progress = await getOnboarding(viewer);
  const siteId = progress?.siteId;
  if (!siteId || progress.completedAt || progress.mapResolvedAt)
    throw new Problem(
      409,
      "Reload to continue onboarding from the current step.",
    );
  await requireMapEditor(viewer, siteId);
  const bounds = selection ? coverageBounds(selection) : null;
  const archive = selection
    ? await prepareMap(selection, selection.sourceRevision)
    : null;

  await getDatabase()
    .transaction()
    .execute(async (tx) => {
      await lockSiteAdministrator(viewer, siteId, tx);
      const { rows } = await sql`
      UPDATE admin_onboarding SET map_resolved_at = now()
      WHERE user_id = ${viewer.id} AND site_id = ${siteId}
        AND map_resolved_at IS NULL AND completed_at IS NULL
      RETURNING site_id
    `.execute(tx);
      if (!rows.length)
        throw new Problem(
          409,
          "Reload to continue onboarding from the current step.",
        );
      if (selection && bounds && archive)
        await saveArchive(tx, siteId, selection, bounds, archive);
    });
}
