"use client";

import dynamic from "next/dynamic";

export const SiteMap = dynamic(() => import("./site-map-canvas"), {
  ssr: false,
  loading: () => (
    <p className="grid min-h-72 place-items-center rounded-lg border bg-muted text-sm">
      Loading site map…
    </p>
  ),
});
