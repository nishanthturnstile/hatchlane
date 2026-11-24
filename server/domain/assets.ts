import { sql } from "kysely";
import { DatabaseError } from "pg";
import type {
  Asset,
  AssetCreation,
  AssetPin,
  AssetUpdate,
  PinUpdate,
} from "../../lib/assets.ts";
import type {
  DoorAssignment,
  LockRemoval,
  ManholeLock,
} from "../../lib/manhole-locks.ts";
import { isWithinRadius, type SiteLocation } from "../../lib/site-map.ts";
import type { Viewer } from "../auth/auth.ts";
import { type Database, getDatabase } from "../db/database.ts";
import { Problem } from "./problems.ts";
import { lockSiteAdministrator } from "./sites.ts";

const assetColumns = sql`id, printed_id AS "printedId", name,
  location_note AS "locationNote", pin, pin_revision AS "pinRevision"`;

export async function listSiteAssets(siteId: string) {
  const { rows } = await sql<Asset>`
    SELECT ${assetColumns} FROM site_asset WHERE site_id = ${siteId}
    ORDER BY lower(printed_id)
  `.execute(getDatabase());
  return rows;
}

export async function getSiteAsset(
  siteId: string,
  id: string,
  db = getDatabase(),
) {
  const { rows } = await sql<Asset>`
    SELECT ${assetColumns} FROM site_asset WHERE site_id = ${siteId} AND id = ${id}
  `.execute(db);
  if (!rows[0]) throw new Problem(404, "Manhole not found.");
  return rows[0];
}

async function writeAsset<T>(
  viewer: Viewer,
  siteId: string,
  write: (db: Database) => Promise<T>,
) {
  try {
    return await getDatabase()
      .transaction()
      .execute(async (tx) => {
        await lockSiteAdministrator(viewer, siteId, tx);
        return write(tx);
      });
  } catch (error) {
    if (
      error instanceof DatabaseError &&
      error.code === "23505" &&
      error.constraint === "site_asset_printed_id"
    ) {
      throw new Problem(
        409,
        "A manhole with this ID already exists at this site.",
        "duplicate-asset-id",
      );
    }
    if (
      error instanceof DatabaseError &&
      error.code === "23505" &&
      error.constraint === "manhole_lock_serial_key"
    ) {
      throw new Problem(
        409,
        "This lock is already assigned.",
        "duplicate-lock-id",
      );
    }
    throw error;
  }
}

export function createAsset(
  viewer: Viewer,
  siteId: string,
  asset: AssetCreation,
) {
  const pin = asset.pin ? JSON.stringify(asset.pin) : null;
  return writeAsset(viewer, siteId, async (tx) => {
    const { rows } = await sql<Asset>`
      INSERT INTO site_asset (id, site_id, printed_id, name, location_note, pin)
      VALUES (${asset.id}, ${siteId}, ${asset.printedId}, ${asset.name},
              ${asset.locationNote}, ${pin}::jsonb)
      ON CONFLICT (id) DO NOTHING
      RETURNING ${assetColumns}
    `.execute(tx);
    if (rows[0]) {
      await validatePinCoverage(tx, siteId, asset.pin);
      return rows[0];
    }

    const retry = await sql<Asset>`
      SELECT ${assetColumns} FROM site_asset
      WHERE id = ${asset.id} AND site_id = ${siteId}
        AND printed_id = ${asset.printedId} AND name = ${asset.name}
        AND location_note = ${asset.locationNote}
        AND pin IS NOT DISTINCT FROM ${pin}::jsonb
    `.execute(tx);
    if (!retry.rows[0])
      throw new Problem(409, "This manhole request has already been used.");
    return retry.rows[0];
  });
}

async function validatePinCoverage(
  db: Database,
  siteId: string,
  pin: AssetPin | null,
) {
  if (!pin) return;
  const {
    rows: [coverage],
  } = await sql<SiteLocation>`
    SELECT latitude, longitude, radius_km AS "radiusKm"
    FROM site_map WHERE site_id = ${siteId} FOR SHARE
  `.execute(db);
  if (!coverage || !isWithinRadius(coverage, pin.latitude, pin.longitude))
    throw new Problem(
      409,
      "Choose a pin inside the current site map area or save without a pin.",
      "pin-outside-site-map",
    );
}

export function updateAsset(
  viewer: Viewer,
  siteId: string,
  id: string,
  asset: AssetUpdate,
) {
  const pin = asset.pin ? JSON.stringify(asset.pin) : null;
  return writeAsset(viewer, siteId, async (tx) => {
    const { rows } = await sql<Asset>`
      UPDATE site_asset SET printed_id = ${asset.printedId}, name = ${asset.name},
        location_note = ${asset.locationNote}
      WHERE site_id = ${siteId} AND id = ${id}
        AND (${asset.pin === undefined} OR pin IS NOT DISTINCT FROM ${pin}::jsonb)
      RETURNING ${assetColumns}
    `.execute(tx);
    if (rows[0]) return rows[0];
    await getSiteAsset(siteId, id, tx);
    throw new Problem(409, "Use Unlock pin to change the manhole location.");
  });
}

export function updateAssetPin(
  viewer: Viewer,
  siteId: string,
  id: string,
  change: PinUpdate,
) {
  const pin = change.pin ? JSON.stringify(change.pin) : null;
  return writeAsset(viewer, siteId, async (tx) => {
    const { rows } = await sql<Asset>`
      UPDATE site_asset
      SET pin = ${pin}::jsonb, pin_revision = pin_revision + 1
      WHERE site_id = ${siteId} AND id = ${id} AND pin_revision = ${change.pinRevision}
      RETURNING ${assetColumns}
    `.execute(tx);
    if (rows[0]) {
      await validatePinCoverage(tx, siteId, change.pin);
      return rows[0];
    }
    const retried = await sql<Asset>`
      SELECT ${assetColumns} FROM site_asset
      WHERE site_id = ${siteId} AND id = ${id}
        AND pin_revision = ${change.pinRevision + 1}
        AND pin IS NOT DISTINCT FROM ${pin}::jsonb
    `.execute(tx);
    if (retried.rows[0]) return retried.rows[0];
    await getSiteAsset(siteId, id, tx);
    throw new Problem(
      409,
      "The pin changed while you were editing it. Close the editor and reopen the manhole.",
    );
  });
}

export async function listSiteLocks(siteId: string, manholeId?: string) {
  const scope = manholeId ? sql`AND a.id = ${manholeId}` : sql``;
  const { rows } = await sql<ManholeLock>`
    SELECT l.manhole_id AS "manholeId", l.door, l.serial, l.description
    FROM manhole_lock l JOIN site_asset a ON a.id = l.manhole_id
    WHERE a.site_id = ${siteId} ${scope}
    ORDER BY l.door
  `.execute(getDatabase());
  return rows;
}

export function assignLock(
  viewer: Viewer,
  siteId: string,
  id: string,
  lock: DoorAssignment,
) {
  return writeAsset(viewer, siteId, async (tx) => {
    const { rows } = await sql<ManholeLock>`
      INSERT INTO manhole_lock (manhole_id, door, serial, description)
      SELECT id, ${lock.door}::smallint, ${lock.serial}, ${lock.description} FROM site_asset
      WHERE site_id = ${siteId} AND id = ${id}
      ON CONFLICT (manhole_id, door) DO NOTHING
      RETURNING manhole_id AS "manholeId", door, serial, description
    `.execute(tx);
    if (rows[0]) return rows[0];
    await getSiteAsset(siteId, id, tx);
    const retry = await sql<ManholeLock>`
      SELECT manhole_id AS "manholeId", door, serial, description
      FROM manhole_lock WHERE manhole_id = ${id} AND door = ${lock.door}
        AND serial = ${lock.serial} AND description = ${lock.description}
    `.execute(tx);
    if (retry.rows[0]) return retry.rows[0];
    throw new Problem(
      409,
      "This door already has a lock assigned.",
      "door-already-assigned",
    );
  });
}

export function removeLock(
  viewer: Viewer,
  siteId: string,
  id: string,
  lock: LockRemoval,
) {
  return writeAsset(viewer, siteId, async (tx) => {
    await getSiteAsset(siteId, id, tx);
    const {
      rows: [removed],
    } = await sql<ManholeLock>`
      DELETE FROM manhole_lock l USING site_asset a
      WHERE a.id = l.manhole_id AND a.site_id = ${siteId} AND a.id = ${id}
        AND l.door = ${lock.door} AND l.serial = ${lock.serial}
      RETURNING l.manhole_id AS "manholeId", l.door, l.serial, l.description
    `.execute(tx);
    if (!removed)
      throw new Problem(
        409,
        "The assignment changed. Reopen the manhole to review the current locks.",
        "lock-assignment-changed",
      );
    return removed;
  });
}
