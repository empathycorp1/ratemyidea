"use client";

import { useState } from "react";
import "@/app/home.css";
import "@/app/highlight.css";
import { MAX_BID, MIN_BID } from "@/lib/board-ui";
import AmountStepper from "./AmountStepper";

interface Props {
  submissionId: number;
  ideaText: string;
  category: string;
  total: number;
  topAmount: number;
  initialAmount: number;
}

export default function HighlightCheckout({
  submissionId,
  ideaText,
  category,
  total,
  topAmount,
  initialAmount,
}: Props) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  });
  const [amount, setAmount] = useState(initialAmount);
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            final — non-refundable. <a href="#">Terms</a>
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
