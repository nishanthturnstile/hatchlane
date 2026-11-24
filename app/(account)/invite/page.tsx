import Link from "next/link";
import { AuthCard } from "@/components/account/auth-card";
import { PasswordForm } from "@/components/account/password-form";
import { SignOut } from "@/components/account/sign-out";
import { invitePath, signInPath } from "@/lib/account-paths";
import { inviteToken } from "@/lib/schemas";
import { currentViewer } from "@/server/auth/page-access";
import { readInvitation } from "@/server/domain/invitations";
import { AcceptInvitation } from "./accept-invitation";

export default async function InvitePage({
  searchParams,
}: PageProps<"/invite">) {
  const token = inviteToken.safeParse((await searchParams).token);
  const invitation = token.success ? await readInvitation(token.data) : null;
  if (!token.success || !invitation) {
    return (
      <AuthCard
        title="Invitation unavailable"
        description="This invitation has expired or already been used. Ask your site Admin for help."
      >
        <Link
          href="/sign-in"
          className="w-fit text-sm font-medium underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </AuthCard>
    );
  }
  const viewer = await currentViewer();
  const next = invitePath(token.data);
  return (
    <AuthCard
      title={`Join ${invitation.siteName}`}
      description={`This invitation was sent to ${invitation.email}.`}
    >
      {viewer ? (
        viewer.email === invitation.email ? (
          <AcceptInvitation token={token.data} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Switch to the invited account to accept this invitation.
            </p>
            <SignOut next={next} />
          </div>
        )
      ) : invitation.hasAccount ? (
        <Link
          href={signInPath(next)}
          prefetch={false}
          className="w-fit text-sm font-medium underline underline-offset-4"
        >
          Sign in to accept
        </Link>
      ) : (
        <PasswordForm token={token.data} mode="invite" />
      )}
    </AuthCard>
  );
}
