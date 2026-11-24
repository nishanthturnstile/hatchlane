import { Clock3Icon } from "lucide-react";
import { notFound } from "next/navigation";
import { DeleteSiteDialog } from "@/components/account/delete-site-dialog";
import { InviteForm } from "@/components/account/invite-form";
import { siteId } from "@/lib/schemas";
import { requireWorkspaceViewer } from "@/server/auth/page-access";
import { getSite, getSiteDeletionImpact } from "@/server/domain/sites";
import { SystemHealth } from "../../system-health";

export default async function SiteWorkspace({
  params,
}: PageProps<"/workspace/[siteId]">) {
  const id = siteId.safeParse((await params).siteId);
  if (!id.success) notFound();
  const viewer = await requireWorkspaceViewer(`/workspace/${id.data}`);
  const current = await getSite(viewer, id.data);
  if (!current) notFound();
  const canManage = viewer.role === "admin" && current.role === "admin";
  const deletionImpact = canManage
    ? await getSiteDeletionImpact(current.id)
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section
        aria-labelledby="site-overview-title"
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1
            id="site-overview-title"
            className="min-w-0 wrap-anywhere text-3xl font-semibold tracking-tight"
          >
            {current.name}
          </h1>
          {deletionImpact && (
            <DeleteSiteDialog
              siteId={current.id}
              name={current.name}
              impact={deletionImpact}
            />
          )}
        </div>
        {current.description && (
          <p className="wrap-anywhere max-w-prose text-sm leading-relaxed">
            {current.description}
          </p>
        )}
        <dl className="flex flex-wrap gap-3 border-t pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Clock3Icon className="size-4" aria-hidden="true" />
            <dt className="font-medium">Time zone</dt>
            <dd>{current.timeZone}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-medium">Site access</dt>
            <dd>{canManage ? "Administrator" : "Member"}</dd>
          </div>
        </dl>
      </section>
      {canManage && (
        <>
          <section
            aria-labelledby="invite-heading"
            className="flex flex-col gap-5 rounded-xl border bg-card p-5 text-card-foreground sm:p-8"
          >
            <div className="flex flex-col gap-2">
              <h2 id="invite-heading" className="text-lg font-semibold">
                Invite a site member
              </h2>
              <p className="text-sm">
                Send a private link to join {current.name}.
              </p>
            </div>
            <InviteForm siteId={current.id} key={current.id} />
          </section>
          <div className="rounded-xl border bg-card text-card-foreground">
            <SystemHealth />
          </div>
        </>
      )}
    </div>
  );
}
