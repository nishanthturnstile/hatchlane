"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { messageFrom, post } from "@/lib/client-api";
import {
  containsBounds,
  coverageBounds,
  defaultMapRadius,
  type MapSelection,
  type MapSource,
  maxMapRadius,
  minMapRadius,
  type SiteLocation,
  siteLocation,
} from "@/lib/site-map";
import { SiteMap } from "./site-map";

export function SiteLocationForm({
  siteId,
  source,
  saved,
  onSaved,
  onCancel,
  onCreate,
  onboarding = false,
}: {
  source: MapSource | null;
  saved?: SiteLocation;
  onSaved?: () => void;
  onCancel?: () => void;
} & (
  | { siteId: string; onboarding?: boolean; onCreate?: never }
  | {
      siteId?: never;
      onboarding?: never;
      onCreate: (location: MapSelection | null) => Promise<void>;
    }
)) {
  const router = useRouter();
  const fieldId = useId();
  const [skipping, setSkipping] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<SiteLocation>();
  const {
    register,
    control,
    getFieldState,
    getValues,
    setValue,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteLocation),
    defaultValues: saved ?? { radiusKm: defaultMapRadius },
  });
  const location = siteLocation.safeParse(useWatch({ control }));
  const outOfCoverage =
    source &&
    location.success &&
    !containsBounds(source.bounds, coverageBounds(location.data));

  function focusCoordinates() {
    const selection = siteLocation.safeParse(getValues());
    if (selection.success) setCameraTarget(selection.data);
  }

  async function submit(selection: SiteLocation | null) {
    if (selection && !source) return;
    const data =
      selection && source
        ? { ...selection, sourceRevision: source.revision }
        : null;
    try {
      if (onCreate) {
        await onCreate(data);
        return;
      }
      if (onboarding) {
        await post("/api/onboarding/map", { location: data });
      } else if (data) {
        await post(`/api/sites/${siteId}/map`, data);
      }
      onSaved?.();
      router.refresh();
    } catch (error) {
      setError("root", { message: messageFrom(error) });
    }
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit(submit)}>
      <FieldGroup>
        <FormError message={errors.root?.message} />
        {source ? (
          <>
            <SiteMap
              archiveUrl={
                siteId
                  ? `/api/sites/${siteId}/map/source/${source.revision}`
                  : `/api/map/source/${source.revision}`
              }
              bounds={source.bounds}
              location={location.success ? location.data : undefined}
              cameraTarget={cameraTarget}
              autoLocate={!saved}
              selectionDisabled={isSubmitting || skipping}
              onReload={() => router.refresh()}
              onPick={(lat, lng, automatic) => {
                if (
                  automatic &&
                  (getFieldState("latitude").isDirty ||
                    getFieldState("longitude").isDirty)
                )
                  return false;
                setValue("latitude", Number(lat.toFixed(6)), {
                  shouldDirty: true,
                  shouldValidate: getFieldState("latitude").invalid,
                });
                setValue("longitude", Number(lng.toFixed(6)), {
                  shouldDirty: true,
                  shouldValidate: getFieldState("longitude").invalid,
                });
                return true;
              }}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id={`${fieldId}-map-latitude`}
                label="Latitude"
                error={errors.latitude?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("latitude", {
                      valueAsNumber: true,
                      onChange: focusCoordinates,
                    })}
                    type="number"
                    step="any"
                    disabled={isSubmitting || skipping}
                    required
                  />
                )}
              </FormField>
              <FormField
                id={`${fieldId}-map-longitude`}
                label="Longitude"
                error={errors.longitude?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("longitude", {
                      valueAsNumber: true,
                      onChange: focusCoordinates,
                    })}
                    type="number"
                    step="any"
                    disabled={isSubmitting || skipping}
                    required
                  />
                )}
              </FormField>
              <FormField
                id={`${fieldId}-map-radius`}
                label="Radius (km)"
                description="0.5 to 10 km"
                error={errors.radiusKm?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("radiusKm", {
                      valueAsNumber: true,
                      onChange: focusCoordinates,
                    })}
                    type="number"
                    step="0.1"
                    min={minMapRadius}
                    max={maxMapRadius}
                    disabled={isSubmitting || skipping}
                    required
                  />
                )}
              </FormField>
            </div>
            {outOfCoverage && (
              <p role="status" className="text-sm">
                The circle extends outside the installed map. Move the center or
                reduce the radius.
              </p>
            )}
            {location.success && !outOfCoverage && (
              <p className="text-sm">
                Map coverage is approximately{" "}
                {new Intl.NumberFormat(undefined, {
                  maximumFractionDigits: 2,
                }).format(Math.PI * location.data.radiusKm ** 2)}{" "}
                km².
              </p>
            )}
          </>
        ) : (
          <p className="text-sm">
            Ask the local workspace Admin to install a regional map. You can set
            the location from Site Explorer later.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {source && (
            <Button
              type="submit"
              className="min-h-12"
              disabled={isSubmitting || skipping || Boolean(outOfCoverage)}
            >
              {isSubmitting ? "Preparing map…" : "Save site map"}
            </Button>
          )}
          {(onboarding || onCreate) && (
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              disabled={isSubmitting || skipping}
              onClick={async () => {
                setSkipping(true);
                try {
                  await submit(null);
                } finally {
                  setSkipping(false);
                }
              }}
            >
              Skip for now
            </Button>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isSubmitting || skipping}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}
