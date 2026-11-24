import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { currentViewer } from "@/server/auth/page-access";
import { regionalMap } from "@/server/domain/map-source";
import { listSites } from "@/server/domain/sites";
import { WorkspaceShell } from "./workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await currentViewer();
  if (!viewer) return children;
  const canCreateSite = viewer.role === "admin";
  const [sites, preferences, mapSource] = await Promise.all([
    listSites(viewer),
    cookies(),
    canCreateSite ? regionalMap() : null,
  ]);
  return (
    <WorkspaceShell
      account={{ name: viewer.name, email: viewer.email }}
      canCreateSite={canCreateSite}
      mapSource={mapSource}
      defaultOpen={preferences.get("sidebar_state")?.value !== "false"}
      sites={sites.map(({ id, name }) => ({ id, name }))}
    >
      {children}
    </WorkspaceShell>
  );
}
