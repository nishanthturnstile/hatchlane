"use client";

import { useState } from "react";
import { FormError } from "@/components/account/form-error";
import { Button } from "@/components/ui/button";
import { messageFrom, post } from "@/lib/client-api";

export function AcceptInvitation({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      <Button
        className="min-h-12"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const { siteId } = await post<{ siteId: string }>(
              "/api/invitations/accept",
              { token },
            );
            window.location.replace(`/workspace/${siteId}`);
          } catch (failure) {
            setError(messageFrom(failure));
            setPending(false);
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}
