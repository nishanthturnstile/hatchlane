import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-7 rounded-xl border bg-card p-5 text-card-foreground shadow-xs sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="wrap-anywhere text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm leading-relaxed">{description}</p>
      </div>
      {children}
    </section>
  );
}
