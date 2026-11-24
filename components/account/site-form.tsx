"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useId } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { messageFrom, post } from "@/lib/client-api";
import {
  defaultSiteTimeZone,
  type SiteFields,
  siteFields,
  timeZones,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function SiteForm({
  onContinue,
  cancelAction,
}: {
  onContinue?: (details: SiteFields) => void;
  cancelAction?: ReactNode;
}) {
  const router = useRouter();
  const fieldId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteFields),
    defaultValues: { name: "", timeZone: defaultSiteTimeZone, description: "" },
  });

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(async (data) => {
        try {
          if (onContinue) {
            onContinue(data);
          } else {
            await post("/api/onboarding/site", data);
            router.refresh();
          }
        } catch (error) {
          setError("root", { message: messageFrom(error) });
        }
      })}
    >
      <FieldGroup>
        <FormError message={errors.root?.message} />
        <FormField
          id={`${fieldId}-site-name`}
          label="Site name"
          error={errors.name?.message}
        >
          {(props) => <Input {...props} {...register("name")} required />}
        </FormField>
        <FormField
          id={`${fieldId}-time-zone`}
          label="Time zone"
          description="Used for permit windows and activity timestamps."
          error={errors.timeZone?.message}
        >
          {(props) => (
            <NativeSelect
              {...props}
              {...register("timeZone")}
              className="w-full"
              required
            >
              {timeZones.map((timeZone) => (
                <NativeSelectOption key={timeZone} value={timeZone}>
                  {timeZone.replaceAll("_", " ")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id={`${fieldId}-description`}
          label="Description (optional)"
          error={errors.description?.message}
        >
          {(props) => (
            <Textarea
              {...props}
              {...register("description")}
              maxLength={500}
              rows={3}
            />
          )}
        </FormField>
        <div
          className={cn("flex flex-wrap gap-2", cancelAction && "justify-end")}
        >
          {cancelAction}
          <Button className="min-h-12" type="submit" disabled={isSubmitting}>
            {onContinue
              ? "Continue to site location"
              : "Save site and continue"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
