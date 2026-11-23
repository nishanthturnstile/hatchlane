import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hatchlane",
  description: "Local simulation workspace",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="isolate">{children}</div>
      </body>
    </html>
  );
}
