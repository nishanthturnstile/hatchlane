"use client";

import { CheckIcon, OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const results = {
  ready: {
    icon: CheckIcon,
    title: "Database reachable",
    variant: "default",
  },
  unavailable: {
    icon: OctagonAlertIcon,
    title: "Database unavailable",
    description: "Verify that PostgreSQL is running, then check again.",
    variant: "destructive",
  },
  unreachable: {
    icon: TriangleAlertIcon,
    title: "Health check unavailable",
    description: "Check your connection to the workspace, then try again.",
    variant: "default",
  },
} as const;

export function SystemHealth() {
  const [status, setStatus] = useState<
    keyof typeof results | "idle" | "checking"
  >("idle");

  async function checkHealth() {
    setStatus("checking");

    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });

      if (response.status === 503) {
        setStatus("unavailable");
      } else {
        setStatus(response.ok ? "ready" : "unreachable");
      }
    } catch {
      setStatus("unreachable");
    }
  }

  const result =
    status === "idle" || status === "checking" ? null : results[status];

  return (
    <section aria-labelledby="system-health" className="px-4 py-6 md:px-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="system-health" className="text-lg font-semibold">
            System health
          </h2>
          <p className="text-sm">
            Verify that Hatchlane can reach its database.
          </p>
        </div>
        <Button
          className="h-auto min-h-12 max-w-full whitespace-normal py-2"
          disabled={status === "checking"}
          focusableWhenDisabled
          onClick={checkHealth}
        >
          Check system health
        </Button>
      </div>
      <div role="status" className="not-empty:mt-4">
        {status === "checking" && (
          <p className="text-sm">Checking connection…</p>
        )}
        {result && (
          <Alert role="presentation" variant={result.variant}>
            <result.icon aria-hidden="true" />
            <AlertTitle>{result.title}</AlertTitle>
            {"description" in result && (
              <AlertDescription>{result.description}</AlertDescription>
            )}
          </Alert>
        )}
      </div>
    </section>
  );
}
