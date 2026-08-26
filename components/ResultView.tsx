"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoreBreakdown } from "@/lib/types";

export interface ResultIdea {
  id: number;
  ideaText: string;
  verdict: string;
  total: number;
  category: string;
  scores: ScoreBreakdown;
  rank: number;
  totalSubmissions: number;
}

// Order and labels from result-page-prototype.html's DIMS array.
const DIMS: Array<[keyof ScoreBreakdown, string, number]> = [
  ["originality", "Originality", 25],
  ["willingness_to_pay", "Willingness to pay", 25],
  ["weekend_copy_risk", "Weekend copy risk", 20],
  ["real_problem", "Real problem", 20],
  ["delusion_index", "Delusion index", 10],
];

// Verbatim from result-page-prototype.html's MEANS array.
const MEANS = [
  "How many times this has already been built. An idea that exists in several funded companies scores near zero here, however well it is executed.",
  "Whether a stranger would actually hand over money for it. What people say they want and what they pay for are different things.",
  "Whether a competent developer could rebuild the core of this in two days. Scoring high needs a real moat: proprietary data, network effects, regulation, or genuine technical difficulty.",
  "Whether this hurts someone today, often and expensively. It also has to still be unsolved. If an established service already handles it well, this scores low even when the pain is real.",
  "How much of this depends on things that will not happen. Ten means every assumption is reasonable. Zero means it needs people to change ingrained habits, or a large incumbent to cooperate.",
];

// Hard-coded per instructions — the prototype's .picker/setDur (letting
// you switch between 3.2s/5s/7s) is scaffolding, not part of the design.
const DUR = 5000;

function fillPercent(idea: ResultIdea, n: number): number {
  const [key, , max] = DIMS[n];
  return (idea.scores[key] / max) * 100;
}

interface RevealFlags {
  rank: boolean;
  verdict: boolean;
  breakdown: boolean;
  note: boolean;
  actions: boolean;
  nudge: boolean;
}

interface Props {
  idea: ResultIdea;
  /** true only for the person who just submitted — see countUp below. */
  animate: boolean;
  onScoreAnother: () => void;
}

export default function ResultView({ idea, animate, onScoreAnother }: Props) {
  const scoreRef = useRef<HTMLDivElement>(null);
  const ranOnce = useRef(false);

  const [revealed, setRevealed] = useState<RevealFlags>({
    rank: !animate,
    verdict: !animate,
    breakdown: !animate,
    note: !animate,
    actions: !animate,
    nudge: !animate,
  });
  const [noteVisible, setNoteVisible] = useState(!animate && idea.total < 30);
  const [fillPct, setFillPct] = useState<number[]>(() =>
    DIMS.map((_, n) => (animate ? 0 : fillPercent(idea, n)))
  );
  const [openExplain, setOpenExplain] = useState<number | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // countUp — transcribed from result-page-prototype.html's countUp()
  // function, exactly as written (the easing, the overshoot-and-settle,
  // the velocity-driven blur, the scale/opacity ramp), only adapted
  // from getElementById to a ref and from raw setTimeout chains to
  // React state for the reveal sequencing that follows it.
  useEffect(() => {
    if (!animate || ranOnce.current) return;
    ranOnce.current = true;

    const node = scoreRef.current;
    if (!node) return;

    const target = idea.total;
    const amp = Math.max(2, Math.round(target * 0.06));
    const peak = Math.max(target - amp, 0);
    const split = 0.62; // most of the time goes to the climb
    let start: number | null = null;
    let prev = 0;

    node.style.filter = "blur(0px)";
    node.style.transform = "scale(0.96)";
    node.style.opacity = "0.62";

    function done() {
      // verdict only becomes readable once the number has settled
      setTimeout(() => setRevealed((r) => ({ ...r, rank: true })), 60);
      setTimeout(() => setRevealed((r) => ({ ...r, verdict: true })), 180);
      setTimeout(() => {
        setRevealed((r) => ({ ...r, breakdown: true }));
        DIMS.forEach((_, n) => {
          setTimeout(() => {
            setFillPct((prevArr) => {
              const next = [...prevArr];
              next[n] = fillPercent(idea, n);
              return next;
            });
          }, n * 90);
        });
      }, 620);

      let t = 1300;
      if (target < 30) {
        setTimeout(() => {
          setNoteVisible(true);
          setRevealed((r) => ({ ...r, note: true }));
        }, t);
        t += 260;
      }
      setTimeout(() => setRevealed((r) => ({ ...r, actions: true })), t);
      setTimeout(() => setRevealed((r) => ({ ...r, nudge: true })), t + 220);
    }

    function frame(ts: number) {
      if (start === null) start = ts;
      const p = Math.min((ts - start!) / DUR, 1);
      let v: number;

      if (p < split) {
        // quintic ease-in-out: barely moves at first, then gathers pace
        const q = p / split;
        const e =
          q < 0.5 ? 16 * q * q * q * q * q : 1 - Math.pow(-2 * q + 2, 5) / 2;
        v = peak * e;
      } else {
        // overshoot, swing back, tighten onto the number
        const q = (p - split) / (1 - split);
        v = target - amp * Math.exp(-2.6 * q) * Math.cos(8.2 * q);
      }

      node!.textContent = String(Math.round(v));

      // faster movement gets softer edges, the way real motion does
      const vel = Math.abs(v - prev);
      prev = v;
      node!.style.filter = `blur(${Math.min(vel * 1.9, 2.1).toFixed(2)}px)`;

      // continuous motion the eye reads as smooth, even while the digits step
      const grow = 0.96 + 0.04 * Math.min(p / split, 1);
      node!.style.transform = `scale(${grow})`;
      node!.style.opacity = (
        0.62 +
        0.38 * Math.min(p / (split * 0.35), 1)
      ).toFixed(3);

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        node!.textContent = String(target);
        node!.style.transform = "scale(1)";
        node!.style.opacity = "1";
        node!.style.filter = "blur(0px)";
        done();
      }
    }

    requestAnimationFrame(frame);
    // ranOnce guards this from running twice (e.g. React StrictMode's
    // double-invoke in dev); `idea`/`animate` intentionally aren't
    // re-run triggers here — a new idea gets a fresh ResultView via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  async function handleShare() {
    const url = `${window.location.origin}/idea/${idea.id}`;
    const shareData = {
      // What people see in messaging apps before the image loads, so
      // it leads with the line that's actually worth reading.
      title: `${idea.verdict} — RateMyIdea`,
      text: idea.verdict,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the share sheet — not an error
      }
      return;
    }
    setShareMenuOpen((v) => !v);
  }

  function shareUrl() {
    return `${window.location.origin}/idea/${idea.id}`;
  }

  function shareToX() {
    const url = shareUrl();
    const text = `${idea.total}/100 — ${idea.verdict}`;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShareMenuOpen(false);
  }

  function shareToLinkedIn() {
    const url = shareUrl();
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShareMenuOpen(false);
  }

  function shareToWhatsApp() {
    const url = shareUrl();
    const text = `${idea.verdict} ${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShareMenuOpen(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShareMenuOpen(false);
    }, 1200);
  }

  return (
    <div className="result-view">
      <p className="result-submitted">{idea.ideaText}</p>

      <div className="result-scorewrap">
        <div className="result-score" ref={scoreRef}>
          {animate ? 0 : idea.total}
        </div>
        <div className="result-outof">out of 100</div>
      </div>

      <p className={`result-verdict result-reveal${revealed.verdict ? " in" : ""}`}>
        {idea.verdict}
      </p>

      {/* Moved below the verdict (was above it) — see app/result.css. */}
      <div className={`result-rank result-reveal${revealed.rank ? " in" : ""}`}>
        Ranked {idea.rank} of {idea.totalSubmissions}
      </div>

      <div
        className={`result-breakdown result-reveal${revealed.breakdown ? " in" : ""}`}
      >
        <h3>How it scored</h3>
        <div>
          {DIMS.map(([key, label, max], n) => (
            <div className="result-row" key={key}>
              <div className="result-rowtop">
                <b>
                  {label}
                  <button
                    className="result-info"
                    aria-label="What this means"
                    onClick={() =>
                      setOpenExplain((cur) => (cur === n ? null : n))
                    }
                  >
                    i
                  </button>
                </b>
                <span>
                  {idea.scores[key]} / {max}
                </span>
              </div>
              <div className="result-track">
                <div
                  className="result-fill"
                  style={{ width: `${fillPct[n]}%` }}
                />
              </div>
              <div className={`result-explain${openExplain === n ? " open" : ""}`}>
                {MEANS[n]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {noteVisible && (
        <div className={`result-note result-reveal${revealed.note ? " in" : ""}`}>
          <b>A low score is a starting point, not a verdict on you.</b>
          <p>
            Most ideas score under 30 because the wedge is unclear, not
            because the idea is worthless. Sharpen who it is for and what
            makes them switch, then score it again.
          </p>
        </div>
      )}

      <div
        className={`result-actions result-reveal${revealed.actions ? " in" : ""}`}
      >
        <button className="result-btn" onClick={handleShare}>
          Share your card
        </button>
        <button className="result-btn ghost" onClick={onScoreAnother}>
          Score another idea
        </button>
        {shareMenuOpen && (
          <div className="result-share-menu">
            <button onClick={shareToX}>Share on X</button>
            <button onClick={shareToLinkedIn}>Share on LinkedIn</button>
            <button onClick={shareToWhatsApp}>Share on WhatsApp</button>
            <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
          </div>
        )}
      </div>

      <div className={`result-nudge result-reveal${revealed.nudge ? " in" : ""}`}>
        <span className="result-tag">The Highlight Board</span>
        {idea.total >= 55 ? (
          <>
            <h4>This one ranks well. Put it where people are looking.</h4>
            <p>
              Highlighted ideas sit at the top of the board, where founders
              and investors browsing the site see them first.
            </p>
          </>
        ) : (
          <>
            <h4>Want a second opinion from actual people?</h4>
            <p>
              Highlighting puts your idea in front of the people browsing the
              board. The scorer is one opinion. They are several hundred.
            </p>
          </>
        )}
        <a href={`/highlight/${idea.id}`}>Highlight this idea</a>
      </div>
    </div>
  );
}
