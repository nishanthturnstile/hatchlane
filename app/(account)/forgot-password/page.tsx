import { AuthCard } from "@/components/account/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot password"
      description="Enter your account email to request a password reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
