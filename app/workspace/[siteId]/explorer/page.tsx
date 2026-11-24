import { notFound } from "next/navigation";
import { explorerPath } from "@/lib/account-paths";
import { siteId } from "@/lib/schemas";
import { requireWorkspaceViewer } from "@/server/auth/page-access";
import { listSiteAssets, listSiteLocks } from "@/server/domain/assets";
import { regionalMap } from "@/server/domain/map-source";
import { getSiteMap } from "@/server/domain/site-maps";
import { getSite } from "@/server/domain/sites";
import { ExplorerMap } from "./explorer-map";

export default async function ExplorerPage({
  params,
}: PageProps<"/workspace/[siteId]/explorer">) {
  const id = siteId.safeParse((await params).siteId);
  if (!id.success) notFound();
  const viewer = await requireWorkspaceViewer(explorerPath(id.data));
  const site = await getSite(viewer, id.data);
  if (!site) notFound();

  const canEdit = viewer.role === "admin" && site.role === "admin";
  const [map, source, assets, locks] = await Promise.all([
    getSiteMap(site.id),
    canEdit ? regionalMap() : null,
    listSiteAssets(site.id),
    listSiteLocks(site.id),
  ]);

  return (
    <ExplorerMap
      key={site.id}
      siteId={site.id}
      siteName={site.name}
      canEdit={canEdit}
      map={map}
      source={source}
      assets={assets}
      locks={locks}
    />
  );
}
