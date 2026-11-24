import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { destination, onboardingPath } from "@/lib/account-paths";
import { currentViewer } from "@/server/auth/page-access";
import { needsOnboarding } from "@/server/domain/sites";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const [params, viewer] = await Promise.all([searchParams, currentViewer()]);
  const next = destination(params.next);
  if (viewer)
    redirect((await needsOnboarding(viewer)) ? onboardingPath(next) : next);
  return (
    <AuthCard
      title="Sign in to Hatchlane"
      description="Use the email address associated with your account."
    >
      <SignInForm next={next} />
    </AuthCard>
  );
}
