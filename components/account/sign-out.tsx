"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signInPath } from "@/lib/account-paths";
import { messageFrom, post } from "@/lib/client-api";

export function useSignOut(next?: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signOut() {
    setPending(true);
    setError(undefined);
    try {
      await post("/api/auth/sign-out");
      window.location.replace(signInPath(next));
    } catch (failure) {
      setError(messageFrom(failure));
      setPending(false);
    }
  }

  return { pending, error, signOut };
}

export function SignOut({ next }: { next?: string }) {
  const { pending, error, signOut } = useSignOut(next);
  return (
    <div>
      <Button
        className="min-h-12"
        variant="outline"
        disabled={pending}
        onClick={signOut}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        Sign out
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
