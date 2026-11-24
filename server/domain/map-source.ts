import { execFile } from "node:child_process";
import {
  type FileHandle,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { bytesToHeader, Compression, TileType } from "pmtiles";
import {
  containsBounds,
  coverageBounds,
  coverageCircle,
  type MapBounds,
  type SiteLocation,
} from "../../lib/site-map.ts";
import { Problem } from "./problems.ts";

const run = promisify(execFile);
const archiveLimit = 20 * 1024 * 1024;
let extracting = false;

async function readBytes(file: FileHandle, length: number, position: number) {
  const buffer = new Uint8Array(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new Error("Incomplete map source");
  return buffer;
}

export async function openRegionalMap() {
  const path = process.env.HATCHLANE_MAP_SOURCE;
  if (!path) return null;
  let file: FileHandle | undefined;
  try {
    file = await open(path, "r");
    const stats = await file.stat();
    const bytes = await readBytes(file, 127, 0);
    const header = bytesToHeader(bytes.buffer);
    const bounds: MapBounds = [
      header.minLon,
      header.minLat,
      header.maxLon,
      header.maxLat,
    ];
    if (
      !stats.isFile() ||
      Buffer.from(bytes.subarray(0, 7)).toString() !== "PMTiles" ||
      header.specVersion !== 3 ||
      header.tileType !== TileType.Mvt ||
      !header.clustered ||
      header.maxZoom < 15 ||
      header.numAddressedTiles === 0 ||
      bounds[0] >= bounds[2] ||
      bounds[1] >= bounds[3] ||
      !containsBounds([-180, -85.05112878, 180, 85.05112878], bounds) ||
      header.jsonMetadataLength < 1 ||
      header.jsonMetadataLength > 1024 * 1024 ||
      header.jsonMetadataOffset < 127 ||
      header.jsonMetadataOffset + header.jsonMetadataLength > stats.size
    )
      throw new Error("Unsupported map source");

    const compressed = await readBytes(
      file,
      header.jsonMetadataLength,
      header.jsonMetadataOffset,
    );
    const metadata = JSON.parse(
      Buffer.from(
        header.internalCompression === Compression.Gzip
          ? gunzipSync(compressed, { maxOutputLength: 1024 * 1024 })
          : compressed,
      ).toString(),
    );
    const layers = new Set(
      metadata.vector_layers?.map((layer: { id: string }) => layer.id),
    );
    if (
      !layers.has("buildings") ||
      !layers.has("roads") ||
      !layers.has("water")
    )
      throw new Error("Unsupported map layers");
    const revision = `${stats.size}-${Math.trunc(stats.mtimeMs)}`;
    return { file, path, bounds, revision, size: stats.size };
  } catch {
    await file?.close();
    return null;
  }
}

export async function regionalMap() {
  const source = await openRegionalMap();
  if (!source) return null;
  await source.file.close();
  return { bounds: source.bounds, revision: source.revision };
}

export async function prepareMap(selection: SiteLocation, revision: string) {
  const source = await openRegionalMap();
  if (!source)
    throw new Problem(
      503,
      "A regional map is required before you can save this area.",
    );
  await source.file.close();
  if (source.revision !== revision)
    throw new Problem(
      409,
      "The regional map changed. Reload to use the new map.",
    );
  if (!containsBounds(source.bounds, coverageBounds(selection)))
    throw new Problem(
      400,
      "Choose a center and radius that fit inside the available region.",
    );
  if (extracting)
    throw new Problem(
      409,
      "Hatchlane is preparing another map. Try again shortly.",
    );

  extracting = true;
  let folder: string | undefined;
  try {
    folder = await mkdtemp(join(tmpdir(), "hatchlane-map-"));
    const output = join(folder, "site.pmtiles");
    const region = join(folder, "coverage.geojson");
    await writeFile(
      region,
      JSON.stringify({
        type: "Polygon",
        coordinates: [coverageCircle(selection)],
      }),
    );
    await run(
      "pmtiles",
      ["extract", source.path, output, `--region=${region}`, "--maxzoom=15"],
      {
        timeout: 20000,
        killSignal: "SIGKILL",
        maxBuffer: 1024 * 1024,
      },
    );
    if ((await stat(output)).size > archiveLimit)
      throw new Problem(
        400,
        "The selected map is too large. Choose a smaller radius.",
      );
    await run("pmtiles", ["verify", output], {
      timeout: 5000,
      killSignal: "SIGKILL",
    });
    return await readFile(output);
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new Problem(
      503,
      "Hatchlane could not prepare this map. Try a smaller area or ask an Admin to check the regional map.",
    );
  } finally {
    extracting = false;
    if (folder) await rm(folder, { recursive: true, force: true });
  }
}
