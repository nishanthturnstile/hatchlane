import {
  Building2Icon,
  CheckIcon,
  CompassIcon,
  MapPinIcon,
  UsersRoundIcon,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/account/brand";
import { InviteForm } from "@/components/account/invite-form";
import { SignOut } from "@/components/account/sign-out";
import { SiteForm } from "@/components/account/site-form";
import { SiteLocationForm } from "@/components/maps/site-location-form";
import { destination, explorerPath } from "@/lib/account-paths";
import { cn } from "@/lib/utils";
import { requireViewer } from "@/server/auth/page-access";
import { regionalMap } from "@/server/domain/map-source";
import { getOnboarding, getSite } from "@/server/domain/sites";
import { OnboardingAction } from "./onboarding-action";

const steps = [
  { label: "Welcome", icon: CompassIcon },
  { label: "Site details", icon: Building2Icon },
  { label: "Site location", icon: MapPinIcon },
  { label: "Invite people", icon: UsersRoundIcon },
];

export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/workspace");

  const [progress, params] = await Promise.all([
    getOnboarding(viewer),
    searchParams,
  ]);
  const next = destination(params.next);
  if (progress?.completedAt) {
    redirect(
      next === "/workspace" && progress.siteId
        ? explorerPath(progress.siteId)
        : next,
    );
  }

  const site = progress?.siteId
    ? await getSite(viewer, progress.siteId)
    : undefined;
  if (progress?.siteId && !site) notFound();
  const current = site ? (progress?.mapResolvedAt ? 3 : 2) : progress ? 1 : 0;
  const source = current === 2 ? await regionalMap() : null;

  return (
    <div className="min-h-svh bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-8">
          <Brand />
          <SignOut />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-8 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-10 md:py-16">
        <aside className="flex flex-col gap-3 md:gap-5">
          <h2 className="text-sm font-semibold">First site setup</h2>
          <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-1 md:gap-2">
            {steps.map(({ label, icon: Icon }, index) => (
              <li
                key={label}
                aria-current={index === current ? "step" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-sm sm:flex-row sm:items-center md:px-3",
                  index === current && "border-border bg-card font-semibold",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md bg-background text-foreground",
                    index === current && "bg-primary text-primary-foreground",
                  )}
                >
                  {index < current ? (
                    <CheckIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <Icon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="wrap-anywhere">
                  {label}
                  {index < current && (
                    <span className="sr-only"> completed</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </aside>
        <section className="flex min-w-0 flex-col gap-7 rounded-xl border bg-card px-5 py-7 text-card-foreground shadow-xs sm:p-10">
          {site && current === 2 ? (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Set site location
                </h1>
                <p className="text-sm leading-relaxed">
                  Choose a center and radius for the map of {site.name}.
                </p>
              </div>
              <SiteLocationForm siteId={site.id} source={source} onboarding />
            </>
          ) : site ? (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Invite people
                </h1>
                <p className="text-sm leading-relaxed">
                  Give someone access to {site.name}. They’ll receive a private
                  invitation by email. You can skip this step.
                </p>
              </div>
              <InviteForm siteId={site.id} />
              <div className="border-t pt-5">
                <OnboardingAction
                  action="complete"
                  label="Open Site Explorer"
                  next={next}
                  variant="outline"
                />
              </div>
            </>
          ) : progress ? (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Create your first site
                </h1>
                <p className="text-sm leading-relaxed">
                  Start with one location. You can add other sites from the
                  workspace.
                </p>
              </div>
              <SiteForm />
            </>
          ) : (
            <div className="flex min-h-64 flex-col justify-center gap-5">
              <Building2Icon
                aria-hidden="true"
                className="size-10 text-primary"
              />
              <div className="flex flex-col gap-3">
                <h1 className="wrap-anywhere text-3xl font-semibold tracking-tight sm:text-4xl">
                  Welcome, {viewer.name}
                </h1>
                <p className="max-w-md text-base leading-relaxed">
                  Create the first site your team will use in Hatchlane. Once
                  it’s ready, you can invite people to join it.
                </p>
              </div>
              <OnboardingAction action="start" label="Get started" />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
