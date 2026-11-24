"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Asset, type AssetPin, assetFields } from "@/lib/assets";
import { messageFrom, post, RequestError } from "@/lib/client-api";

export function AssetForm({
  siteId,
  asset,
  hasMap,
  pin,
  locationControlRef,
  onRemovePin,
  onSaved,
  onCancel,
  onSavingChange,
}: {
  siteId: string;
  asset?: Asset;
  hasMap: boolean;
  pin: AssetPin | null;
  locationControlRef: (node: HTMLDivElement | null) => void;
  onRemovePin: () => void;
  onSaved: (asset: Asset) => void;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const requestId = useRef<string>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assetFields),
    defaultValues: {
      printedId: asset?.printedId ?? "",
      name: asset?.name ?? "",
      locationNote: asset?.locationNote ?? "",
    },
  });
  useEffect(() => setFocus("printedId"), [setFocus]);
  let saveLabel = "Save manhole";
  if (!asset && hasMap)
    saveLabel = pin ? "Save & lock pin" : "Save without a pin";

  return (
    <form
      method="post"
      noValidate
      aria-labelledby="asset-form-title"
      onSubmit={handleSubmit(async (values) => {
        const path = `/api/sites/${siteId}/assets`;
        const id = asset?.id ?? requestId.current ?? crypto.randomUUID();
        requestId.current = id;
        onSavingChange(true);
        try {
          const saved = asset
            ? await post<Asset>(`${path}/${id}`, values)
            : await post<Asset>(path, { ...values, pin, id });
          onSaved(saved);
        } catch (error) {
          const field =
            error instanceof RequestError && error.code === "duplicate-asset-id"
              ? "printedId"
              : "root";
          setError(field, { message: messageFrom(error) });
          if (field === "printedId") setFocus(field);
        } finally {
          onSavingChange(false);
        }
      })}
    >
      <FieldGroup>
        <h2 id="asset-form-title" className="text-lg font-semibold">
          {asset ? "Edit manhole" : "Add manhole"}
        </h2>
        <FormError message={errors.root?.message} />
        <FormField
          id="asset-printed-id"
          label="Manhole ID"
          error={errors.printedId?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register("printedId")}
              autoCapitalize="characters"
              maxLength={64}
              required
            />
          )}
        </FormField>
        <FormField
          id="asset-name"
          label="Manhole name"
          error={errors.name?.message}
        >
          {(props) => (
            <Input {...props} {...register("name")} maxLength={100} required />
          )}
        </FormField>
        <FormField
          id="asset-location-note"
          label="Location note (optional)"
          error={errors.locationNote?.message}
        >
          {(props) => (
            <Textarea
              {...props}
              {...register("locationNote")}
              maxLength={500}
            />
          )}
        </FormField>
        {!asset &&
          (hasMap ? (
            <PinPosition
              pin={pin}
              locationControlRef={locationControlRef}
              onRemove={onRemovePin}
              disabled={isSubmitting}
            />
          ) : (
            <p className="text-sm">You can save this manhole without a pin.</p>
          ))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : saveLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function PinPosition({
  pin,
  locationControlRef,
  onRemove,
  disabled,
}: {
  pin: AssetPin | null;
  locationControlRef: (node: HTMLDivElement | null) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        ref={locationControlRef}
        className="flex flex-col items-start gap-2 empty:hidden"
      />
      <p className="text-sm">
        You can also tap the map to place a pin. Drag it or use the arrow keys
        when it is focused to adjust its position.
      </p>
      <p className="text-sm tabular-nums" role="status">
        {pin
          ? `Pin at ${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}${pin.gps ? ` (estimated accuracy ±${Math.ceil(pin.gps.accuracyMetres)} m)` : ""}`
          : "Without a pin, the manhole is available in the list."}
      </p>
      {pin && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onRemove}
        >
          Remove pin
        </Button>
      )}
    </div>
  );
}

export function PinForm({
  siteId,
  asset,
  pinRevision,
  pin,
  locationControlRef,
  saving,
  onRemovePin,
  onSaved,
  onCancel,
  onSavingChange,
}: {
  siteId: string;
  asset: Asset;
  pinRevision: number;
  pin: AssetPin | null;
  locationControlRef: (node: HTMLDivElement | null) => void;
  saving: boolean;
  onRemovePin: () => void;
  onSaved: (asset: Asset) => void;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [error, setError] = useState<string>();
  async function save() {
    onSavingChange(true);
    setError(undefined);
    try {
      const saved = await post<Asset>(
        `/api/sites/${siteId}/assets/${asset.id}/pin`,
        {
          pin,
          pinRevision,
        },
      );
      onSaved(saved);
    } catch (failure) {
      setError(messageFrom(failure));
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 tabIndex={-1} className="text-lg font-semibold">
          Move manhole pin
        </h2>
        <p className="text-sm">
          {asset.printedId} · {asset.name}
        </p>
      </div>
      <FormError message={error} />
      <PinPosition
        pin={pin}
        locationControlRef={locationControlRef}
        onRemove={onRemovePin}
        disabled={saving}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : pin ? "Save & lock pin" : "Save without a pin"}
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
