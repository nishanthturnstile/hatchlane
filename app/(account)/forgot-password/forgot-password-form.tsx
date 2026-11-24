"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { messageFrom, post } from "@/lib/client-api";
import { forgotFields } from "@/lib/schemas";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotFields),
    defaultValues: { email: "" },
  });

  return (
    <div className="flex flex-col gap-5">
      {submitted ? (
        <Alert role="status">
          <MailIcon aria-hidden="true" />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            If an account uses this email address, we’ll send a reset link.
          </AlertDescription>
        </Alert>
      ) : (
        <form
          method="post"
          noValidate
          onSubmit={handleSubmit(async (data) => {
            try {
              await post("/api/auth/request-password-reset", data);
              setSubmitted(true);
            } catch (error) {
              setError("root", { message: messageFrom(error) });
            }
          })}
        >
          <FieldGroup>
            <FormError message={errors.root?.message} />
            <FormField
              id="email"
              label="Email address"
              error={errors.email?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("email")}
                  type="email"
                  autoComplete="username"
                  required
                />
              )}
            </FormField>
            <Button
              className="min-h-12 w-full"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </FieldGroup>
        </form>
      )}
      <Link
        href="/sign-in"
        className="w-fit text-sm font-medium text-primary underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </div>
  );
}
