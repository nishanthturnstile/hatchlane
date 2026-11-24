import { z } from "zod";

export const manholeDoors = [
  { number: 1, cover: "Outer solid cover" },
  { number: 2, cover: "Inner mesh guard" },
] as const;

export function doorLabel(door: Door) {
  return `Door ${door} · ${manholeDoors[door - 1].cover}`;
}

export const lockFields = z.object({
  serial: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9][A-Z0-9._-]{0,63}$/,
      "Enter a lock ID of up to 64 letters, digits, dots, dashes or underscores.",
    ),
  description: z.string().trim().max(500, "Use at most 500 characters."),
});
export const doorAssignment = lockFields.extend({
  door: z.union([z.literal(1), z.literal(2)]),
  description: lockFields.shape.description.default(""),
});
export const lockRemoval = doorAssignment.pick({ door: true, serial: true });
export type Door = z.infer<typeof doorAssignment>["door"];
export type DoorAssignment = z.infer<typeof doorAssignment>;
export type LockRemoval = z.infer<typeof lockRemoval>;
export type ManholeLock = DoorAssignment & { manholeId: string };

export function readLockQr(payload: string) {
  const match = /^hatchlane:lock:([A-Za-z0-9][A-Za-z0-9._-]{0,63})$/.exec(
    payload,
  );
  if (match?.[1]) return match[1].toUpperCase();
}
