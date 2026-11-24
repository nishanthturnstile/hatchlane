"use client";

import { ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/account/form-error";
import { Button } from "@/components/ui/button";
import { explorerPath } from "@/lib/account-paths";
import { messageFrom, post } from "@/lib/client-api";

export function OnboardingAction({
  action,
  label,
  next,
  variant = "default",
}: {
  action: "start" | "complete";
  label: string;
  next?: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <Button
        variant={variant}
        className="min-h-12 self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          try {
            if (action === "start") {
              await post("/api/onboarding/start");
              router.refresh();
            } else {
              const { siteId } = await post<{ siteId: string | null }>(
                "/api/onboarding/complete",
              );
              window.location.replace(
                next && next !== "/workspace"
                  ? next
                  : siteId
                    ? explorerPath(siteId)
                    : "/workspace",
              );
            }
          } catch (failure) {
            setError(messageFrom(failure));
            setPending(false);
          }
        }}
      >
        {label}
        <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </div>
  );
}
