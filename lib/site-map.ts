import { z } from "zod";

export const defaultMapRadius = 1;
export const minMapRadius = 0.5;
export const maxMapRadius = 10;

export const siteLocation = z.object({
  latitude: z.number().min(-85).max(85),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(minMapRadius).max(maxMapRadius),
});

export type SiteLocation = z.infer<typeof siteLocation>;
export const mapSelection = siteLocation.extend({
  sourceRevision: z
    .string()
    .regex(/^\d+-\d+$/)
    .max(50),
});
export type MapSelection = z.infer<typeof mapSelection>;
export type MapBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];
export type MapSource = { bounds: MapBounds; revision: string };
export type SavedSiteMap = SiteLocation & MapSource;

const earthRadiusKm = 6371.0088;
const radians = Math.PI / 180;

export function coverageBounds({
  latitude,
  longitude,
  radiusKm,
}: SiteLocation): MapBounds {
  const angularRadius = radiusKm / earthRadiusKm;
  const latitudeOffset = angularRadius / radians;
  const longitudeOffset =
    Math.asin(Math.sin(angularRadius) / Math.cos(latitude * radians)) / radians;
  return [
    longitude - longitudeOffset,
    latitude - latitudeOffset,
    longitude + longitudeOffset,
    latitude + latitudeOffset,
  ];
}

export function containsBounds(
  [west, south, east, north]: MapBounds,
  inner: MapBounds,
) {
  return (
    west <= inner[0] &&
    south <= inner[1] &&
    east >= inner[2] &&
    north >= inner[3]
  );
}

export function coverageCircle({
  latitude,
  longitude,
  radiusKm,
}: SiteLocation): [number, number][] {
  const lat = latitude * radians;
  const lng = longitude * radians;
  const arc = radiusKm / earthRadiusKm;
  const points = Array.from({ length: 64 }, (_, index): [number, number] => {
    const angle = (index * Math.PI) / 32;
    const targetLat = Math.asin(
      Math.sin(lat) * Math.cos(arc) +
        Math.cos(lat) * Math.sin(arc) * Math.cos(angle),
    );
    const targetLng =
      lng +
      Math.atan2(
        Math.sin(angle) * Math.sin(arc) * Math.cos(lat),
        Math.cos(arc) - Math.sin(lat) * Math.sin(targetLat),
      );
    return [targetLng / radians, targetLat / radians];
  });
  const first = points[0];
  if (first) points.push(first);
  return points;
}

export function isWithinRadius(
  site: SiteLocation,
  latitude: number,
  longitude: number,
) {
  const differenceLat = (latitude - site.latitude) * radians;
  const differenceLng = (longitude - site.longitude) * radians;
  const arc =
    Math.sin(differenceLat / 2) ** 2 +
    Math.cos(site.latitude * radians) *
      Math.cos(latitude * radians) *
      Math.sin(differenceLng / 2) ** 2;
  return (
    2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, arc))) <= site.radiusKm
  );
}
