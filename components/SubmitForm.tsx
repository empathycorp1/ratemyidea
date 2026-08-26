"use client";

import { useState } from "react";
import type { ResultIdea } from "./ResultView";

interface Props {
  onScored: (data: ResultIdea) => void;
}

// Markup and classes from homepage-prototype.html's .hero block
// (h1, textarea, .count, .submit, .caveat) — see app/home.css.
export default function SubmitForm({ onScored }: Props) {
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }

      if (data.flagged || data.valid === false) {
        setError(data.message || "That couldn't be scored.");
        return;
      }

      // The API response doesn't carry the idea text back (the request
      // already had it) — the caller needs it, so it's merged in here.
      onScored({ ...data, ideaText: idea });
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hero">
      <h1>
        It all starts
        <br />
        with an <em>&ldquo;idea&rdquo;</em>
      </h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={280}
          placeholder="Describe your business idea. Be honest and detailed."
        />
        <div className="count">
          <span>{idea.length}</span>/280
        </div>
        {error && <p className="result-error">{error}</p>}
        <button
          type="submit"
          className="submit"
          disabled={!idea.trim() || submitting}
        >
          {submitting ? "Scoring…" : "Rate My Idea"}
        </button>
      </form>
      <p className="caveat">
        We score how an idea reads in one line, with no context. A working
        business can score low. <a href="#">How scoring works?</a>
      </p>
    </div>
  );
}
