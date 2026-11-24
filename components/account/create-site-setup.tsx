"use client";

import Link from "next/link";
import { type RefObject, useState } from "react";
import { AuthCard } from "@/components/account/auth-card";
import { InviteForm } from "@/components/account/invite-form";
import { SiteForm } from "@/components/account/site-form";
import { SiteLocationForm } from "@/components/maps/site-location-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { explorerPath } from "@/lib/account-paths";
import { post } from "@/lib/client-api";
import type { SiteFields } from "@/lib/schemas";
import type { MapSource } from "@/lib/site-map";
import { cn } from "@/lib/utils";

type Setup =
  | { step: "details" }
  | { step: "location"; details: SiteFields; requestId: string }
  | { step: "invite"; siteId: string; siteName: string };

export function CreateSiteSetup({
  source,
  dialog,
}: {
  source: MapSource | null;
  dialog?: {
    open: boolean;
    onClose: () => void;
    finalFocus: RefObject<HTMLButtonElement | null>;
  };
}) {
  const [setup, setSetup] = useState<Setup>({ step: "details" });
  const [saving, setSaving] = useState(false);
  const choosingLocation = setup.step === "location";

  function dismiss() {
    if (setup.step === "invite") {
      window.location.assign(explorerPath(setup.siteId));
      return;
    }
    setSetup({ step: "details" });
    dialog?.onClose();
  }

  const cancel = dialog ? (
    <Button
      variant="outline"
      className="min-h-12"
      type="button"
      onClick={dismiss}
    >
      Cancel
    </Button>
  ) : (
    <Button
      variant="outline"
      className="min-h-12"
      render={<Link href="/workspace" />}
    >
      Cancel
    </Button>
  );

  let step = "Site details";
  let description = "Add a location to your Hatchlane workspace.";
  let content = (
    <SiteForm
      cancelAction={cancel}
      onContinue={(details) =>
        setSetup({ step: "location", details, requestId: crypto.randomUUID() })
      }
    />
  );
  if (setup.step === "location") {
    step = "Set site location";
    description = `Choose a center and radius for ${setup.details.name}. Saving or skipping the map creates the site.`;
    content = (
      <SiteLocationForm
        source={source}
        onCancel={dialog ? dismiss : () => window.location.assign("/workspace")}
        onCreate={async (location) => {
          setSaving(true);
          try {
            const created = await post<{ siteId: string }>("/api/sites", {
              ...setup.details,
              id: setup.requestId,
              location,
            });
            setSetup({
              step: "invite",
              siteId: created.siteId,
              siteName: setup.details.name,
            });
          } finally {
            setSaving(false);
          }
        }}
      />
    );
  } else if (setup.step === "invite") {
    step = "Invite people";
    description = `Invite people to ${setup.siteName} by email. You can also open Site Explorer now and invite them later.`;
    content = (
      <InviteForm
        siteId={setup.siteId}
        footer={(pending) => (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 self-start"
            disabled={pending}
            onClick={dismiss}
          >
            Open Site Explorer
          </Button>
        )}
      />
    );
  }

  if (!dialog) {
    return (
      <div
        className={cn("mx-auto", choosingLocation ? "max-w-3xl" : "max-w-xl")}
      >
        <AuthCard title={step} description={description}>
          {content}
        </AuthCard>
      </div>
    );
  }

  return (
    <Dialog
      open={dialog.open}
      disablePointerDismissal
      onOpenChange={(open, event) => {
        if (open) return;
        if (saving || event.reason !== "close-press") {
          event.cancel();
          return;
        }
        dismiss();
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] overflow-y-auto [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2 [&>[data-slot=dialog-close]]:size-12",
          choosingLocation && "sm:max-w-3xl",
        )}
        finalFocus={dialog.finalFocus}
        showCloseButton={!saving}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">Create site</DialogTitle>
          <h3 className="font-medium">{step}</h3>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
