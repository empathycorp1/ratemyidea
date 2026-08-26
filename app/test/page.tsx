"use client";

import { useState } from "react";

export default function TestPage() {
  const [idea, setIdea] = useState("");
  const [output, setOutput] = useState("(nothing yet)");
  const [ideaId, setIdeaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setOutput("scoring...");
    setIdeaId(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
      // id is only present when a row actually got stored — invalid
      // and flagged submissions have nothing to link to.
      if (typeof data.id === "number") {
        setIdeaId(data.id);
      }
    } catch (err) {
      setOutput(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h1>scoring engine test page</h1>
      <p>type an idea, hit the button, read the raw JSON below.</p>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={4}
        cols={60}
        placeholder="Describe your idea..."
      />
      <br />
      <button onClick={handleClick} disabled={loading || !idea.trim()}>
        {loading ? "scoring..." : "score it"}
      </button>
      {ideaId !== null && (
        <p>
          <a href={`/idea/${ideaId}`}>view idea page &amp; share card &rarr;</a>
        </p>
      )}
      <pre
        style={{
          background: "#eee",
          color: "#000",
          padding: 10,
          marginTop: 20,
          maxWidth: 700,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {output}
      </pre>
    </div>
  );
}
