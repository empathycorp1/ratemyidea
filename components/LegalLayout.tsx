import type { ReactNode } from "react";
import "@/app/home.css";
import "@/app/legal.css";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

interface Props {
  title: string;
  updated: string;
  lede: string;
  children: ReactNode;
}

// Shared shell for /terms, /refunds, /contact — same page-shell/aurora/
// wrap/header/footer as the rest of the site (via SiteHeader/
// SiteFooter), styled with app/legal.css's `legal-` prefixed classes.
// The source Coming Soon Files/*.html pages had a "Coming soon" pill
// above the h1 — dropped here since these pages are live now, not
// upcoming; everything else about the page-head layout is unchanged.
export default function LegalLayout({ title, updated, lede, children }: Props) {
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
          <p className="legal-updated">Last updated {updated}</p>
          <p className="legal-lede">{lede}</p>

          <main className="legal-main">{children}</main>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
