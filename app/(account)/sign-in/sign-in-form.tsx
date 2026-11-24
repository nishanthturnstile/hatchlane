"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/account/form-error";
import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInPath } from "@/lib/account-paths";
import { messageFrom, post } from "@/lib/client-api";
import { signInFields } from "@/lib/schemas";

export function SignInForm({ next }: { next: string }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signInFields),
  });

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(async (data) => {
        try {
          await post("/api/auth/sign-in/email", data);
          window.location.replace(signInPath(next));
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
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register("password")}
              type="password"
              autoComplete="current-password"
              required
            />
          )}
        </FormField>
        <Link
          href="/forgot-password"
          className="w-fit text-sm font-medium text-primary underline underline-offset-4"
        >
          Forgot password?
        </Link>
        <Button
          className="min-h-12 w-full"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
