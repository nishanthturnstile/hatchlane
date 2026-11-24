"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invitePath, signInPath } from "@/lib/account-paths";
import { messageFrom, post, RequestError } from "@/lib/client-api";
import { name, passwordFields } from "@/lib/schemas";

export function PasswordForm({
  token,
  mode,
}: {
  token: string;
  mode: "reset" | "invite";
}) {
  const isInvite = mode === "invite";
  const [next, setNext] = useState<string>();
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [invalidReset, setInvalidReset] = useState(false);
  const schema = passwordFields
    .safeExtend({ name: name.optional() })
    .refine((data) => !isInvite || Boolean(data.name), {
      path: ["name"],
      message: "Enter your name.",
    });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  if (next)
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          <CheckIcon aria-hidden="true" />
          <AlertTitle>
            {isInvite ? "Account ready" : "Password updated"}
          </AlertTitle>
          <AlertDescription>
            Sign in with your new password to continue.
          </AlertDescription>
        </Alert>
        <Link
          href={next}
          className="w-fit text-sm font-medium text-primary underline underline-offset-4"
        >
          Continue to sign in
        </Link>
      </div>
    );

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(async (data) => {
        try {
          if (isInvite) {
            const result = await post<{ siteId: string }>(
              "/api/invitations/activate",
              { ...data, token },
            );
            setNext(signInPath(`/workspace/${result.siteId}`));
          } else {
            await post("/api/auth/reset-password", { ...data, token });
            setNext("/sign-in");
          }
        } catch (error) {
          const code = error instanceof RequestError ? error.code : undefined;
          if (isInvite && code === "sign-in") setRequiresSignIn(true);
          if (!isInvite && code === "INVALID_TOKEN") {
            setInvalidReset(true);
            setError("root", {
              message: "This reset link has expired or already been used.",
            });
          } else {
            setError("root", { message: messageFrom(error) });
          }
        }
      })}
    >
      <FieldGroup>
        <FormError message={errors.root?.message} />
        {invalidReset && (
          <Link
            href="/forgot-password"
            className="w-fit text-sm font-medium underline underline-offset-4"
          >
            Request a new reset link
          </Link>
        )}
        {requiresSignIn && (
          <Link
            href={signInPath(invitePath(token))}
            prefetch={false}
            className="w-fit text-sm font-medium underline underline-offset-4"
          >
            Sign in to accept
          </Link>
        )}
        {isInvite && (
          <FormField id="name" label="Full name" error={errors.name?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("name")}
                autoComplete="name"
                required
              />
            )}
          </FormField>
        )}
        <FormField
          id="new-password"
          label="New password"
          description="Use at least 12 characters."
          error={errors.password?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register("password")}
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </FormField>
        <FormField
          id="confirm-password"
          label="Confirm password"
          error={errors.confirmation?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register("confirmation")}
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </FormField>
        <Button
          className="min-h-12 w-full"
          type="submit"
          disabled={isSubmitting}
        >
          {isInvite ? "Set password and join site" : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
