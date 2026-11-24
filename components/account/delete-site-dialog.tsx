"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { messageFrom, post, RequestError } from "@/lib/client-api";
import type { SiteDeletionImpact } from "@/lib/schemas";

export function DeleteSiteDialog({
  siteId,
  name,
  impact,
}: {
  siteId: string;
  name: string;
  impact: SiteDeletionImpact;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const counts = [
    ["Saved site map and boundary", impact.hasMap ? 1 : 0],
    ["Manholes and their pins", impact.manholes],
    ["Smart-lock assignments", impact.locks],
    ["Site memberships", impact.memberships],
    ["Site invitations", impact.invitations],
  ] as const;

  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(open, event) => {
        if (pending) {
          event.cancel();
        } else if (!open) {
          setConfirmation("");
          setError(undefined);
        }
      }}
    >
      <DialogTrigger
        render={<Button variant="destructive" className="min-h-12" />}
      >
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        Delete site
      </DialogTrigger>
      <DialogContent
        showCloseButton={!pending}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">Delete site</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            Permanently delete <strong>{name}</strong> and the data below.
            People keep their accounts and access to their other sites.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 rounded-md border bg-muted p-3">
          {counts.map(([label, count]) => (
            <div className="flex justify-between gap-3" key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || confirmation !== name) return;
            setPending(true);
            setError(undefined);
            try {
              await post(`/api/sites/${siteId}/delete`, {
                name: confirmation,
                impact,
              });
              window.location.replace("/workspace");
            } catch (failure) {
              if (
                failure instanceof RequestError &&
                failure.code === "site-impact-changed"
              ) {
                setConfirmation("");
                router.refresh();
              }
              setError(messageFrom(failure));
              setPending(false);
            }
          }}
        >
          <FormError message={error} />
          <FormField
            id="site-deletion-confirmation"
            label="Type the site name to confirm"
          >
            {(props) => (
              <Input
                {...props}
                value={confirmation}
                disabled={pending}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="min-h-12"
                  type="button"
                  disabled={pending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-12"
              disabled={pending || confirmation !== name}
            >
              {pending ? "Deleting…" : "Permanently delete site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
