import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireWorkspaceViewer } from "@/server/auth/page-access";

export default async function AccountSettingsPage() {
  const viewer = await requireWorkspaceViewer("/workspace/account/settings");

  return (
    <section className="flex max-w-xl flex-col gap-5 rounded-xl border bg-card p-5 text-card-foreground sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Account settings
      </h1>
      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="font-medium">Name</dt>
          <dd className="wrap-anywhere">{viewer.name}</dd>
        </div>
        <div>
          <dt className="font-medium">Email address</dt>
          <dd className="wrap-anywhere">{viewer.email}</dd>
        </div>
      </dl>
      <Link
        href="/forgot-password"
        className={cn(buttonVariants({ variant: "outline" }), "min-h-12 w-fit")}
      >
        Reset password
      </Link>
    </section>
  );
}
