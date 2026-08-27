import type { ReactNode } from "react";
import "@/app/home.css";
import "@/app/legal.css";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

interface Props {
  title: string;
  /** Omit entirely on a page with nothing to "update" on a fixed date —
   *  e.g. /stats, which is live on every load rather than revised on a
   *  schedule. When given, pairs with `updatedLabel`. */
  updated?: string;
  /** Defaults to "Last updated" (the legal pages' wording). /stats
   *  overrides this to "Live as of" since its `updated` is a request-
   *  time timestamp, not a revision date. */
  updatedLabel?: string;
  lede: string;
  children: ReactNode;
}

// Shared shell for /terms, /refunds, /contact, /how-scoring-works,
// /stats — same page-shell/aurora/wrap/header/footer as the rest of
// the site (via SiteHeader/SiteFooter), styled with app/legal.css's
// `legal-` prefixed classes. The source Coming Soon Files/*.html pages
// had a "Coming soon" pill above the h1 — dropped here since these
// pages are live now, not upcoming; everything else about the
// page-head layout is unchanged.
export default function LegalLayout({
  title,
  updated,
  updatedLabel = "Last updated",
  lede,
  children,
}: Props) {
  return (
    <div className="page-shell">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="blob b5" />
      </div>

      <div className="wrap">
        <SiteHeader />

        <div className="legal-view">
          <h1>{title}</h1>
          {updated && (
            <p className="legal-updated">
              {updatedLabel} {updated}
            </p>
          )}
          <p className="legal-lede">{lede}</p>

          <main className="legal-main">{children}</main>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
