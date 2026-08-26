"use client";

import { useEffect, useState } from "react";
import "@/app/result.css";
import "@/app/home.css";
import type { HighlightRow, LiveStats, MeritRow } from "@/lib/get-board-data";
import { getDeviceId } from "@/lib/device-id";
import { MIN_BID, ranges, slice } from "@/lib/board-ui";
import ResultView, { type ResultIdea } from "./ResultView";
import SubmitForm from "./SubmitForm";
import CategoryTabs from "./CategoryTabs";
import RangeSelector from "./RangeSelector";
import AmountStepper from "./AmountStepper";

const HEART_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 20.7l-1.4-1.3C5.4 14.6 2 11.5 2 7.9 2 5.1 4.2 3 7 3c1.7 0 3.3.8 4 2 .8-1.2 2.4-2 4-2 2.9 0 5 2.1 5 4.9 0 3.6-3.4 6.7-8.6 11.5z" />
  </svg>
);

interface Props {
  /** Present when loaded server-side from /idea/[id] — a direct or
   *  shared visit. Absent on the plain homepage, which starts on the
   *  empty submission box. */
  initialResult?: ResultIdea;
  meritRows: MeritRow[];
  highlightRows: HighlightRow[];
  liveStats: LiveStats;
  topHighlightAmount: number;
}

export default function RateMyIdeaApp({
  initialResult,
  meritRows: initialMeritRows,
  highlightRows,
  liveStats,
  topHighlightAmount,
}: Props) {
  const [result, setResult] = useState<ResultIdea | null>(
    initialResult ?? null
  );
  // Only true for the person who just submitted — never for a direct
  // or shared /idea/[id] load. See ResultView's countUp effect.
  const [animate, setAnimate] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [deviceId, setDeviceId] = useState("");

  const [meritRows, setMeritRows] = useState(initialMeritRows);
  const [mtCat, setMtCat] = useState("All");
  const [mtRange, setMtRange] = useState(10);

  const [hlCat, setHlCat] = useState("All");
  const [hlRange, setHlRange] = useState(10);

  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState(MIN_BID);

  // Sync the toggle icon with whatever the blocking bootstrap script in
  // app/layout.tsx already set on <html>, without touching it during
  // the initial render (avoids a hydration mismatch — see that file).
  useEffect(() => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Presence heartbeat: an initial ping, then repeated every ~25s while
  // this tab is open, so "here now" doesn't undercount visitors who
  // stay past the first minute. See lib/presence.ts.
  useEffect(() => {
    if (!deviceId) return;
    const ping = () => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 25000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // Close any open "More" popup on an outside click — ported from
  // homepage-prototype.html's document click listener.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".moreWrap")) setOpenPopupId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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
      // localStorage unavailable — the toggle still works for this
      // page view, it just won't be remembered next time.
    }
  }

  function handleScored(idea: ResultIdea) {
    setResult(idea);
    setAnimate(true);
    // Update the URL without a Next.js navigation — the box just gave
    // way to the result in place, nothing reloaded or re-fetched.
    window.history.pushState(null, "", `/idea/${idea.id}`);
    // The new idea now exists on the Merit Board too.
    setMeritRows((rows) =>
      [
        {
          id: idea.id,
          total: idea.total,
          ideaText: idea.ideaText,
          category: idea.category,
          likes: 0,
          likedByMe: false,
        },
        ...rows,
      ].sort((a, b) => b.total - a.total)
    );
  }

  function handleScoreAnother() {
    setResult(null);
    setAnimate(false);
    window.history.pushState(null, "", "/");
  }

  async function handleLike(row: MeritRow) {
    if (!deviceId) return;
    const wasLiked = row.likedByMe;
    // Optimistic update — matches the prototype's instant toggle.
    setMeritRows((rows) =>
      rows.map((r) =>
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
        setMeritRows((rows) =>
          rows.map((r) =>
            r.id === row.id
              ? { ...r, likedByMe: data.liked, likes: data.likes }
              : r
          )
        );
      } else {
        throw new Error(data.error || "failed");
      }
    } catch {
      // Revert on failure.
      setMeritRows((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, likedByMe: wasLiked, likes: row.likes }
            : r
        )
      );
    }
  }

  const filteredMerit = meritRows.filter(
    (r) => mtCat === "All" || r.category === mtCat
  );
  const [meritSlice, meritOffset] = slice(filteredMerit, mtRange);

  const filteredHighlights = highlightRows.filter(
    (h) => hlCat === "All" || h.category === hlCat
  );
  const [hlSlice] = slice(filteredHighlights, hlRange);

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
        <header>
          <div className="brandwrap">
            <span className="mark" />
            <span className="brand">
              <b>ratemyidea</b>.fun
            </span>
          </div>
          <button
            className="toggle"
            onClick={flip}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </header>

        {result ? (
          <ResultView
            key={result.id}
            idea={result}
            animate={animate}
            onScoreAnother={handleScoreAnother}
          />
        ) : (
          <SubmitForm onScored={handleScored} />
        )}

        <div className="live">
          <span>
            <span className="dot" />
            <b>{liveStats.hereNow}</b> here now
          </span>
          <span>
            <b className="scored">{liveStats.totalScored.toLocaleString()}</b>{" "}
            ideas scored
          </span>
          <span>
            <b className="earned">
              ${liveStats.totalEarned.toLocaleString()}
            </b>{" "}
            earned
          </span>
          <a className="full" href="#">
            Full stats &rarr;
          </a>
        </div>

        <section>
          <div className="banner highlight">
            <h2>The Highlight Board</h2>
            <span className="tag">Featured &middot; ranked by spend</span>
            <p>
              Pay your way up and have more eyes be fascinated about your
              idea. Starts at $5.
            </p>
            <a className="more" href="#">
              Get Featured &rarr;
            </a>
          </div>

          <div className="claim">
            <AmountStepper
              topAmount={topHighlightAmount}
              amount={bidAmount}
              onAmountChange={setBidAmount}
            />
            <a className="go" href={`/highlight?amount=${bidAmount}`}>
              Highlight
            </a>
          </div>

          <RangeSelector
            total={filteredHighlights.length}
            current={hlRange}
            onChange={(v) => setHlRange(v)}
          />
          <CategoryTabs
            id="hlTabs"
            active={hlCat}
            onChange={(c) => {
              setHlCat(c);
              setHlRange(10);
            }}
            openPopupId={openPopupId}
            onOpenPopupChange={setOpenPopupId}
          />
          <div>
            {hlSlice.length === 0 ? (
              <p style={{ color: "var(--faint)", fontSize: 15, padding: "8px 0" }}>
                Nothing featured here yet.
              </p>
            ) : (
              hlSlice.map((h) => (
                <div className="hl" key={h.id}>
                  <div className="logo">{h.initial}</div>
                  <div className="body">
                    <p>{h.ideaText}</p>
                    <div className="meta">
                      <span>{h.category}</span>
                      <span>{h.visits.toLocaleString()} visits</span>
                    </div>
                  </div>
                  <div className="right">
                    <div className="amt">${h.amount.toLocaleString()}</div>
                    <a className="go" href={`/idea/${h.submissionId}`}>
                      View &rarr;
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="banner merit">
            <h2>The Merit Board</h2>
            <span className="tag">Free &middot; ranked by score</span>
            <p>
              Every idea lands here, ordered by what it scored. Money cannot
              move it up, unless highlighted.
            </p>
            <a className="more" href="#">
              See the Full Board &rarr;
            </a>
          </div>

          <RangeSelector
            total={filteredMerit.length}
            current={mtRange}
            onChange={(v) => setMtRange(v)}
          />
          <CategoryTabs
            id="mtTabs"
            active={mtCat}
            onChange={(c) => {
              setMtCat(c);
              setMtRange(10);
            }}
            openPopupId={openPopupId}
            onOpenPopupChange={setOpenPopupId}
          />
          <div>
            {meritSlice.length === 0 ? (
              <p style={{ color: "var(--faint)", fontSize: 15, padding: "14px 0" }}>
                No ideas in this category yet.
              </p>
            ) : (
              meritSlice.map((r, i) => (
                <div className="row" key={r.id}>
                  <div className="n">{meritOffset + i + 1}</div>
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
        </section>

        <footer>
          <div className="flinks">
            <a className="lead" href="#">
              How scoring works?
            </a>
          </div>
          <div className="flinks">
            <a href="#">Terms</a>
            <a href="#">Refunds</a>
            <a href="#">Contact</a>
          </div>
          <div className="byline">
            <span>
              ratemyidea.fun - a fun side project by{" "}
              <a href="https://x.com/yoursansh33">@yoursansh33</a>
            </span>
            <img src="/avatar.jpg" alt="Ansh Jaisinghani" />
          </div>
          <div className="built">
            <p>Built with</p>
            <div className="set">
              <a href="https://claude.ai" target="_blank" rel="noopener">
                Claude AI
              </a>
              <a
                href="https://claude.com/product/claude-code"
                target="_blank"
                rel="noopener"
              >
                Claude Code
              </a>
              <a href="https://vercel.com" target="_blank" rel="noopener">
                Vercel
              </a>
              <a
                href="https://dodopayments.com"
                target="_blank"
                rel="noopener"
              >
                Dodo Payments
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
