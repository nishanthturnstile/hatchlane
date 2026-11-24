import { z } from "zod";

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254));
export const name = z.string().trim().min(1, "Enter a name.").max(100);

export const passwordLimits = { min: 12, max: 128 } as const;
export const password = z
  .string()
  .min(passwordLimits.min, "Use at least 12 characters.")
  .max(passwordLimits.max, "Use at most 128 characters.");
export const passwordFields = z
  .object({
    password,
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ["confirmation"],
    message: "The passwords do not match.",
  });

export const signInFields = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(passwordLimits.max),
});
export const forgotFields = z.object({ email });
export const administratorFields = z.object({ name, email, password });
export const resetToken = z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/);
export const inviteToken = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);

export const siteId = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const defaultSiteTimeZone = "Asia/Kolkata";
export const timeZones = Array.from(
  new Set([defaultSiteTimeZone, "UTC", ...Intl.supportedValuesOf("timeZone")]),
).filter((timeZone) => timeZone !== "Asia/Calcutta");
const knownTimeZones = new Set([...timeZones, "Asia/Calcutta"]);
export const siteFields = z.object({
  name,
  timeZone: z.string().refine((value) => knownTimeZones.has(value), {
    message: "Choose a time zone from the list.",
  }),
  description: z
    .string()
    .trim()
    .max(500, "Use at most 500 characters.")
    .default(""),
});
export type SiteFields = z.infer<typeof siteFields>;
export const siteCreation = siteFields.extend({ id: z.uuid() });
const siteDeletionImpact = z.object({
  hasMap: z.boolean(),
  manholes: z.int().nonnegative(),
  locks: z.int().nonnegative(),
  memberships: z.int().nonnegative(),
  invitations: z.int().nonnegative(),
});
export type SiteDeletionImpact = z.infer<typeof siteDeletionImpact>;
export const siteDeletion = z.object({
  name: z.string().min(1).max(100),
  impact: siteDeletionImpact,
});

export const invitationFields = z.object({ token: inviteToken });
export const activationFields = passwordFields.safeExtend({ name });
