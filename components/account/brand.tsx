import { Layers3Icon } from "lucide-react";
import Link from "next/link";

export function Brand({
  href = "/",
  onNavigate,
}: {
  href?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      className="inline-flex min-h-12 items-center gap-2.5 font-semibold tracking-tight"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Layers3Icon className="size-4" aria-hidden="true" />
      </span>
      Hatchlane
    </Link>
  );
}
