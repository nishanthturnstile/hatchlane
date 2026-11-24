"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlusIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { messageFrom, post } from "@/lib/client-api";
import { forgotFields } from "@/lib/schemas";

export function InviteForm({
  siteId,
  footer,
}: {
  siteId: string;
  footer?: (pending: boolean) => ReactNode;
}) {
  const emailId = useId();
  const [sent, setSent] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotFields),
    defaultValues: { email: "" },
  });

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(async (data) => {
        setSent(undefined);
        try {
          await post(`/api/sites/${siteId}/invitations`, data);
          setSent(data.email);
          reset();
        } catch (error) {
          setError("root", { message: messageFrom(error) });
        }
      })}
    >
      <FieldGroup>
        <FormError message={errors.root?.message} />
        <FormField
          id={emailId}
          label="Member email address"
          error={errors.email?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register("email")}
              type="email"
              autoComplete="off"
              required
            />
          )}
        </FormField>
        <Button
          className="min-h-12 self-start"
          type="submit"
          disabled={isSubmitting}
        >
          <MailPlusIcon data-icon="inline-start" aria-hidden="true" />
          {isSubmitting ? "Sending…" : "Send invitation"}
        </Button>
        {sent && (
          <Alert role="status">
            <AlertDescription>Invitation sent to {sent}.</AlertDescription>
          </Alert>
        )}
        {footer?.(isSubmitting)}
      </FieldGroup>
    </form>
  );
}
