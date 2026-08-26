"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/app/home.css";
import "@/app/highlight.css";

interface Props {
  submissionId: number;
  highlightId: number;
}

type Status = "pending" | "active" | "refunded" | "failed" | "flagged" | "error";

const POLL_MS = 2500;
const SLOW_AFTER_MS = 15000;

export default function HighlightDone({ submissionId, highlightId }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  });
  const [status, setStatus] = useState<Status>("pending");
  const [slow, setSlow] = useState(false);
  // Set on the first poll (inside the effect, not during render) so
  // this stays a pure read of "when did polling actually start."
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    if (startedAt.current === null) startedAt.current = Date.now();

    async function poll() {
      try {
        const res = await fetch(`/api/highlight/status/${highlightId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("status fetch failed");
        const data = await res.json();
        if (cancelled) return;

        const s: Status = data.flagged
          ? "flagged"
          : (data.status as Status) ?? "pending";
        setStatus(s);

        if (Date.now() - startedAt.current! > SLOW_AFTER_MS) setSlow(true);

        // Stop polling once we've reached a resting state — 'pending'
        // is the only state that still needs another look.
        if (s === "pending") {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [highlightId]);

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

  const copy = {
    pending: {
      title: "Confirming your payment…",
      body: "Dodo Payments is finalizing the charge. This page will update itself — no need to refresh.",
    },
    active: {
      title: "You're live on the Highlight Board",
      body: "Your idea is featured now. It stays there until someone else pays more for the spot.",
    },
    refunded: {
      title: "This placement was refunded",
      body: "The payment for this placement was refunded, so it's no longer on the Highlight Board.",
    },
    failed: {
      title: "The payment didn't go through",
      body: "Dodo reported this checkout as failed or cancelled. Nothing was charged, and your idea was not featured.",
    },
    flagged: {
      title: "We're double-checking this payment",
      body: "Something about this payment needs a manual look before it goes live — this isn't a failure. Email support@ratemyidea.fun with your idea link if it's still like this in a few minutes.",
    },
    error: {
      title: "Couldn't check payment status",
      body: "There was a problem reaching the server. Your payment may still have gone through — check back shortly.",
    },
  }[status];

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
            <img src="/icon.svg" alt="" width={22} height={22} className="mark" />
            <span className="brand">
              <b>ratemyidea</b>.fun
            </span>
          </div>
          <button className="toggle" onClick={flip} aria-label="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </header>

        <div className="hlchk-status-card">
          <span className={`hlchk-status-dot ${status}`} />
          <h1 className="hlchk-status-title">{copy.title}</h1>
          <p className="hlchk-status-body">{copy.body}</p>
          {status === "pending" && slow && (
            <p className="hlchk-status-slow">
              Still working on it — this can occasionally take a minute.
            </p>
          )}

          <div className="hlchk-actions">
            {status === "active" && (
              <a className="primary" href={`/idea/${submissionId}`}>
                View your idea
              </a>
            )}
            {status === "failed" && (
              <a className="primary" href={`/highlight/${submissionId}`}>
                Try again
              </a>
            )}
            <Link className="secondary" href="/">
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
