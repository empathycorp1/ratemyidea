"use client";

import { useEffect, useState } from "react";
import "@/app/home.css";
import "@/app/legal.css";
import type { MeritRow } from "@/lib/get-board-data";
import { getDeviceId } from "@/lib/device-id";
import { ranges, slice } from "@/lib/board-ui";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import CategoryTabs from "./CategoryTabs";
import RangeSelector from "./RangeSelector";

const HEART_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 20.7l-1.4-1.3C5.4 14.6 2 11.5 2 7.9 2 5.1 4.2 3 7 3c1.7 0 3.3.8 4 2 .8-1.2 2.4-2 4-2 2.9 0 5 2.1 5 4.9 0 3.6-3.4 6.7-8.6 11.5z" />
  </svg>
);

interface Props {
  initialRows: MeritRow[];
}

// The full Merit Board — every entry, not just the top slice the
// homepage widget shows. Same category-filter/range-selector/like
// behavior as that widget (components/RateMyIdeaApp.tsx), reusing the
// exact same child components (CategoryTabs, RangeSelector) and
// home.css classes (.row/.tab/.ranges/.heart) — this is genuinely the
// same board, just unconstrained, not a separate design.
export default function FullBoardView({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [cat, setCat] = useState("All");
  const [range, setRange] = useState(10);
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Close any open "More" category popup on an outside click — same
  // behavior as the homepage board.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".moreWrap")) setOpenPopupId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function handleLike(row: MeritRow) {
    if (!deviceId) return;
    const wasLiked = row.likedByMe;
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? { ...r, likedByMe: !wasLiked, likes: r.likes + (wasLiked ? -1 : 1) }
          : r
      )
    );
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: row.id, deviceId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRows((rs) =>
          rs.map((r) =>
            r.id === row.id
              ? { ...r, likedByMe: data.liked, likes: data.likes }
              : r
          )
        );
      } else {
        throw new Error(data.error || "failed");
      }
    } catch {
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id
            ? { ...r, likedByMe: wasLiked, likes: row.likes }
            : r
        )
      );
    }
  }

  const filtered = rows.filter((r) => cat === "All" || r.category === cat);
  const [pageRows, offset] = slice(filtered, range);

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
          <h1>The Merit Board</h1>
          <p className="legal-lede">
            Every idea that&rsquo;s been scored, ranked by score alone.
            Money cannot move it up here — that&rsquo;s what the
            Highlight Board is for.
          </p>

          <div className="legal-main">
            <RangeSelector
              total={filtered.length}
              current={range}
              onChange={setRange}
            />
            <CategoryTabs
              id="boardTabs"
              active={cat}
              onChange={(c) => {
                setCat(c);
                setRange(10);
              }}
              openPopupId={openPopupId}
              onOpenPopupChange={setOpenPopupId}
            />
            <div>
              {pageRows.length === 0 ? (
                <p style={{ color: "var(--faint)", fontSize: 15, padding: "14px 0" }}>
                  No ideas in this category yet.
                </p>
              ) : (
                pageRows.map((r, i) => (
                  <div className="row" key={r.id}>
                    <div className="n">{offset + i + 1}</div>
                    <div className="idea">
                      {r.ideaText}
                      <span>{r.category}</span>
                    </div>
                    <div className="end">
                      <div className="sc">{r.total}</div>
                      <button
                        className={`heart${r.likedByMe ? " on" : ""}`}
                        onClick={() => handleLike(r)}
                      >
                        {HEART_SVG}
                        <span>{r.likes}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
