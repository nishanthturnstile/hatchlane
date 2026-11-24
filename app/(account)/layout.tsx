import type { ReactNode } from "react";
import { Brand } from "@/components/account/brand";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-2 sm:px-8">
          <Brand />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-md flex-1 content-start px-4 py-8 sm:content-center sm:px-0 sm:py-16">
        {children}
      </main>
    </div>
  );
}
