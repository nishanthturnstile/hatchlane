import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { onboardingPath, signInPath } from "@/lib/account-paths";
import { needsOnboarding } from "../domain/sites";
import { getViewer } from "./auth";

export const currentViewer = cache(() => headers().then(getViewer));

export async function requireViewer(next = "/workspace") {
  const viewer = await currentViewer();
  if (!viewer) redirect(signInPath(next));
  return viewer;
}

export async function requireWorkspaceViewer(next = "/workspace") {
  const viewer = await requireViewer(next);
  if (await needsOnboarding(viewer)) redirect(onboardingPath(next));
  return viewer;
}
