import { notFound } from "next/navigation";
import { CreateSiteSetup } from "@/components/account/create-site-setup";
import { requireWorkspaceViewer } from "@/server/auth/page-access";
import { regionalMap } from "@/server/domain/map-source";

export default async function NewSitePage() {
  const viewer = await requireWorkspaceViewer("/workspace/new");
  if (viewer.role !== "admin") notFound();
  return <CreateSiteSetup source={await regionalMap()} />;
}
