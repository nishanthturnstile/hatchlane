import { z } from "zod";
import { name } from "./schemas.ts";

const assetPin = z.object({
  latitude: z.number().min(-85).max(85),
  longitude: z.number().min(-180).max(180),
  gps: z
    .object({
      accuracyMetres: z.number().nonnegative(),
      capturedAt: z.iso.datetime(),
    })
    .optional(),
});

export const assetId = z.uuid();
export const assetFields = z.object({
  printedId: z
    .string()
    .trim()
    .min(1, "Enter the printed asset ID.")
    .max(64, "Use at most 64 characters."),
  name,
  locationNote: z.string().trim().max(500, "Use at most 500 characters."),
});
export const assetDetails = assetFields.extend({
  locationNote: assetFields.shape.locationNote.default(""),
  pin: assetPin.nullable().default(null),
});
export const assetCreation = assetDetails.extend({ id: assetId });
export const assetUpdate = assetDetails.extend({
  pin: assetPin.nullable().optional(),
});
export const pinUpdate = z.object({
  pin: assetPin.nullable(),
  pinRevision: z.number().int().min(0).max(2_147_483_646),
});

export type AssetPin = z.infer<typeof assetPin>;
export type AssetCreation = z.infer<typeof assetCreation>;
export type AssetUpdate = z.infer<typeof assetUpdate>;
export type PinUpdate = z.infer<typeof pinUpdate>;
export type Asset = AssetCreation & { pinRevision: number };
