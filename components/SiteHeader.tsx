"use client";

import { useLayoutEffect, useState } from "react";

// The same header markup used on the homepage/result view
// (RateMyIdeaApp.tsx) and the Highlight checkout/done screens —
// extracted here so the legal pages (app/terms, app/refunds,
// app/contact) get an identical header without a fourth copy of this
// theme-toggle logic. Self-contained: reads the data-theme the
// blocking bootstrap script in app/layout.tsx already set, and flips
// it the same way everywhere else does.
export default function SiteHeader() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  });

  // Re-applies whatever the blocking bootstrap script in app/layout.tsx
  // already set, in case React's hydration reset cleared it — see the
  // comment on <html> in app/layout.tsx for why this is needed
  // specifically on statically-rendered pages (the legal pages this
  // header is used on). A no-op whenever the attribute already matches.
  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem("rmi_theme");
      const resolved =
        stored === "dark" || stored === "light"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      if (resolved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      setTheme(resolved);
    } catch {
      // localStorage unavailable — leave whatever the DOM already has.
    }
  }, []);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      window.localStorage.setItem("rmi_theme", next);
    } catch {
      // Unavailable — the toggle still works for this page view.
    }
  }

  return (
    <header>
      {/* A plain <a>, not next/link — this needs to be a real
          navigation everywhere it appears, including on the homepage
          itself, where a soft client-side transition to a route
          Next's router doesn't realize it's already left (the result
          view gets there via a manual history.pushState, not a real
          route change — see RateMyIdeaApp.tsx) could no-op instead of
          actually resetting the page. */}
      <a className="brandwrap" href="/">
        <img src="/icon.svg" alt="" width={22} height={22} className="mark" />
        <span className="brand">
          <b>ratemyidea</b>.fun
        </span>
      </a>
      <button className="toggle" onClick={flip} aria-label="Toggle theme">
        {theme === "dark" ? "☀" : "☾"}
      </button>
    </header>
  );
}
