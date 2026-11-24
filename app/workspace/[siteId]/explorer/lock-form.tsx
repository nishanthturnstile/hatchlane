"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ScanLineIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Asset } from "@/lib/assets";
import { messageFrom, post, RequestError } from "@/lib/client-api";
import {
  type Door,
  doorLabel,
  lockFields,
  type ManholeLock,
} from "@/lib/manhole-locks";
import { LockQrScanner } from "./lock-qr-scanner";

export function LockForm({
  siteId,
  manhole,
  door,
  onSaved,
  onCancel,
  onConflict,
}: {
  siteId: string;
  manhole: Asset;
  door: Door;
  onSaved: (lock: ManholeLock) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lockFields),
    defaultValues: { serial: "", description: "" },
  });
  const onResult = useCallback(
    (serial: string) => {
      setValue("serial", serial, { shouldValidate: true, shouldDirty: true });
      setScanOpen(false);
    },
    [setValue],
  );

  return (
    <>
      <form
        method="post"
        noValidate
        aria-labelledby="add-lock-heading"
        onSubmit={handleSubmit(async (values) => {
          try {
            onSaved(
              await post<ManholeLock>(
                `/api/sites/${siteId}/assets/${manhole.id}/locks`,
                { ...values, door },
              ),
            );
          } catch (error) {
            if (
              error instanceof RequestError &&
              error.code === "door-already-assigned"
            )
              onConflict();
            const field =
              error instanceof RequestError &&
              error.code === "duplicate-lock-id"
                ? "serial"
                : "root";
            setError(
              field,
              { message: messageFrom(error) },
              { shouldFocus: field === "serial" },
            );
          }
        })}
      >
        <FieldGroup>
          <div>
            <h2
              id="add-lock-heading"
              tabIndex={-1}
              className="text-lg font-semibold"
            >
              Add smart lock
            </h2>
            <p className="text-sm">
              {manhole.printedId} · {manhole.name}
            </p>
            <p className="text-sm font-medium">{doorLabel(door)}</p>
          </div>
          <FormError message={errors.root?.message} />
          <FormField
            id="lock-serial"
            label="Lock ID"
            error={errors.serial?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("serial")}
                autoCapitalize="characters"
                maxLength={64}
                required
              />
            )}
          </FormField>
          <Button
            className="min-h-11 self-start"
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setScanOpen(true)}
          >
            <ScanLineIcon data-icon="inline-start" aria-hidden="true" />
            Scan QR code
          </Button>
          <FormField
            id="lock-description"
            label="Description (optional)"
            error={errors.description?.message}
          >
            {(props) => (
              <Textarea
                {...props}
                {...register("description")}
                maxLength={500}
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Confirm assignment"}
            </Button>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </FieldGroup>
      </form>
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>Scan lock QR code</DialogTitle>
            <DialogDescription>
              {manhole.printedId} · {doorLabel(door)}
            </DialogDescription>
          </DialogHeader>
          {scanOpen && <LockQrScanner onResult={onResult} />}
          <Button variant="outline" onClick={() => setScanOpen(false)}>
            Type the lock ID
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveLockForm({
  siteId,
  manhole,
  lock,
  onSaved,
  onCancel,
  onConflict,
}: {
  siteId: string;
  manhole: Asset;
  lock: ManholeLock;
  onSaved: (lock: ManholeLock) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function remove() {
    setSaving(true);
    setError(undefined);
    try {
      onSaved(
        await post<ManholeLock>(
          `/api/sites/${siteId}/assets/${manhole.id}/locks/remove`,
          {
            door: lock.door,
            serial: lock.serial,
          },
        ),
      );
    } catch (failure) {
      setError(messageFrom(failure));
      if (
        failure instanceof RequestError &&
        failure.code === "lock-assignment-changed"
      )
        onConflict();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 tabIndex={-1} className="text-lg font-semibold">
          Remove lock assignment
        </h2>
        <p className="text-sm">
          {manhole.printedId} · {doorLabel(lock.door)}
        </p>
      </div>
      <p className="wrap-anywhere text-sm">
        Remove <strong>{lock.serial}</strong> from this door so it can be
        assigned again.
      </p>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          disabled={saving}
          onClick={remove}
        >
          {saving ? "Removing…" : "Remove assignment"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
