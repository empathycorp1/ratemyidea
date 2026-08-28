"use client";

import { useEffect, useState } from "react";
import "@/app/home.css";
import "@/app/highlight.css";
import { MAX_BID, MIN_BID } from "@/lib/board-ui";
import { consumePendingHighlightAmount } from "@/lib/highlight-amount-memory";
import AmountStepper from "./AmountStepper";

interface Props {
  submissionId: number;
  ideaText: string;
  category: string;
  total: number;
  topAmount: number;
  /** A real ?amount= from the URL, already validated server-side —
   *  null when there wasn't one, which is the signal to fall back to
   *  a remembered amount from the homepage claim strip instead of
   *  always defaulting to MIN_BID. See app/highlight/[id]/page.tsx. */
  initialAmount: number | null;
  /** The highest active placement already on the board for this idea,
   *  in dollars — null if it has none. See terms.html §05: a second
   *  purchase doesn't top up the first, it creates a separate entry. */
  existingAmount: number | null;
}

export default function HighlightCheckout({
  submissionId,
  ideaText,
  category,
  total,
  topAmount,
  initialAmount,
  existingAmount,
}: Props) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  });
  const [amount, setAmount] = useState(initialAmount ?? MIN_BID);
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No real ?amount= was given — check for one remembered from the
  // homepage claim strip (see lib/highlight-amount-memory.ts). Done in
  // an effect, not a lazy useState initializer, for the same reason
  // the theme toggle reads document.documentElement in an effect
  // rather than at first render: localStorage isn't available during
  // SSR, and reading it at render time would risk a hydration
  // mismatch between server and client output.
  useEffect(() => {
    if (initialAmount !== null) return;
    const remembered = consumePendingHighlightAmount();
    if (remembered !== null) {
      setAmount(Math.min(MAX_BID, Math.max(MIN_BID, remembered)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/highlight/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          amount,
          url: url.trim() || undefined,
          companyName: companyName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      // Full navigation (not a Next transition) — this is Dodo's own
      // hosted checkout, a different origin entirely.
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

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

        <div className="hlchk-main">
          <span className="hlchk-eyebrow">Highlight this idea</span>
          <h1 className="hlchk-title">Get it in front of more people</h1>

          <div className="hlchk-idea-card">
            <p>{ideaText}</p>
            <div className="hlchk-meta">
              <span>{category}</span>
              <span>
                Scored <b>{total}</b>/100
              </span>
            </div>
          </div>

          <p className="hlchk-top">
            Current top spot on the Highlight Board:{" "}
            <b>${topAmount.toLocaleString()}</b>
          </p>

          {existingAmount !== null && (
            <p className="hlchk-existing">
              This idea is already on the board at{" "}
              <b>${existingAmount.toLocaleString()}</b>. A new placement will
              appear as a separate entry.
            </p>
          )}

          <div className="claim hlchk-claim">
            <AmountStepper
              topAmount={topAmount}
              amount={amount}
              onAmountChange={setAmount}
            />
          </div>

          <div className="hlchk-fields">
            <div className="hlchk-field">
              <label htmlFor="hlchk-url">
                Website URL <span className="hlchk-optional">(optional)</span>
              </label>
              <input
                id="hlchk-url"
                type="text"
                inputMode="url"
                placeholder="https://your-site.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="hlchk-field">
              <label htmlFor="hlchk-name">
                Company or product name{" "}
                <span className="hlchk-optional">(optional)</span>
              </label>
              <input
                id="hlchk-name"
                type="text"
                placeholder="Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>

          <p className="hlchk-terms">
            Goes live immediately, stays until someone pays more. Payments are
            final — non-refundable. <a href="/terms">Terms</a>
          </p>

          {error && <p className="hlchk-error">{error}</p>}

          <button
            className="hlchk-submit"
            onClick={handleSubmit}
            disabled={submitting || amount < MIN_BID || amount > MAX_BID}
          >
            {submitting
              ? "Starting checkout…"
              : `Continue to payment — $${amount.toLocaleString()}`}
          </button>

          <a className="hlchk-back" href={`/idea/${submissionId}`}>
            &larr; Back to your idea
          </a>
        </div>
      </div>
    </div>
  );
}
