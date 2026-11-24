import { inviteToken, siteId } from "./schemas";

export function destination(value: string | string[] | undefined): string {
  if (!value || typeof value !== "string") return "/workspace";
  if (value === "/workspace" || value === "/workspace/account/settings")
    return value;
  const site = /^\/workspace\/([^/?#]+)(?:\/explorer)?$/.exec(value)?.[1];
  if (siteId.safeParse(site).success) return value;

  // Reconstruct the app-owned invite destination without accepting arbitrary redirects.
  const token = /^\/invite\?token=([a-zA-Z0-9_-]+)$/.exec(value)?.[1];
  if (inviteToken.safeParse(token).success) return invitePath(token ?? "");
  return "/workspace";
}

export function explorerPath(id: string) {
  return `/workspace/${id}/explorer`;
}

export function invitePath(token: string) {
  return `/invite?token=${encodeURIComponent(token)}`;
}

export function signInPath(next = "/workspace") {
  return next === "/workspace"
    ? "/sign-in"
    : `/sign-in?${new URLSearchParams({ next })}`;
}

export function onboardingPath(next = "/workspace") {
  return next === "/workspace"
    ? "/onboarding"
    : `/onboarding?${new URLSearchParams({ next })}`;
}
