import Link from "next/link";
import { AuthCard } from "@/components/account/auth-card";
import { PasswordForm } from "@/components/account/password-form";
import { resetToken } from "@/lib/schemas";

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const token = resetToken.safeParse((await searchParams).token);
  if (!token.success) {
    return (
      <AuthCard
        title="Reset link unavailable"
        description="Request a new link to reset your password."
      >
        <Link
          href="/forgot-password"
          className="w-fit text-sm font-medium underline underline-offset-4"
        >
          Request a reset link
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Set a new password"
      description="Choose a password for your Hatchlane account."
    >
      <PasswordForm mode="reset" token={token.data} />
    </AuthCard>
  );
}
