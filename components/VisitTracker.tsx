"use client";

import { useEffect } from "react";
import { getDeviceId } from "@/lib/device-id";

// Mounted once in app/layout.tsx, so it covers every page — unlike the
// presence heartbeat (components/RateMyIdeaApp.tsx), which only fires
// on the homepage/idea pages that render it. Fires once per real page
// load: the root layout doesn't remount on soft client-side
// navigations between pages, so this genuinely counts "one visitor
// browsing the site," not "one visitor per page." Renders nothing.
export default function VisitTracker() {
  useEffect(() => {
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    }).catch(() => {
      // A visitor count is a nice-to-have — fail silently.
    });
  }, []);

  return null;
}
