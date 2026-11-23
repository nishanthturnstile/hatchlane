import { Badge } from "@/components/ui/badge";
import { SystemHealth } from "./system-health";

export default function Home() {
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
          <span className="text-sm font-medium">Hatchlane</span>
          <Badge variant="secondary">Simulation</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <div className="border bg-card text-card-foreground">
          <h1 className="wrap-anywhere border-b px-4 py-4 text-2xl font-semibold md:px-6">
            Local simulation workspace
          </h1>
          <SystemHealth />
        </div>
      </main>
    </>
  );
}
