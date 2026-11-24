import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { Button } from "@/components/ui/button";
import { explorerPath } from "@/lib/account-paths";
import { requireWorkspaceViewer } from "@/server/auth/page-access";
import { listSites } from "@/server/domain/sites";

export default async function WorkspacePage() {
  const viewer = await requireWorkspaceViewer();
  const sites = await listSites(viewer);
  if (sites.length) redirect(explorerPath(sites[0].id));
  if (viewer.role === "admin") {
    return (
      <div className="max-w-xl">
        <AuthCard
          title="No sites yet"
          description="Create a site to open its workspace and map."
        >
          <Button
            className="min-h-12 self-start"
            render={<Link href="/workspace/new" />}
          >
            Create site
          </Button>
        </AuthCard>
      </div>
    );
  }
  return (
    <div className="max-w-xl">
      <AuthCard
        title="No sites assigned"
        description="Ask your site Admin to invite you by email."
      >
        <p className="wrap-anywhere text-sm">Signed in as {viewer.email}</p>
      </AuthCard>
    </div>
  );
}
