import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "How Scoring Works · RateMyIdea",
  description:
    "How RateMyIdea scores a business idea: the five dimensions, the published point values, and what the score does and doesn't mean.",
};

// Dimension order, point values, and explanation text ("MEANS") are
// taken verbatim from result-page-prototype.html's DIMS/MEANS arrays,
// which match scoring-spec.md's published rubric table exactly — same
// five names, same 25/25/20/20/10 split. Neither has changed across
// any prompt revision (v1 through the current v3); only the model's
// internal guidance per dimension has been tuned, never the point
// values shown here.
const DIMENSIONS = [
  {
    name: "Originality",
    points: 25,
    means:
      "How many times this has already been built. An idea that exists in several funded companies scores near zero here, however well it is executed.",
  },
  {
    name: "Willingness to pay",
    points: 25,
    means:
      "Whether a stranger would actually hand over money for it. What people say they want and what they pay for are different things.",
  },
  {
    name: "Weekend copy risk",
    points: 20,
    means:
      "Whether a competent developer could rebuild the core of this in two days. Scoring high needs a real moat: proprietary data, network effects, regulation, or genuine technical difficulty.",
  },
  {
    name: "Real problem",
    points: 20,
    means:
      "Whether this hurts someone today, often and expensively. It also has to still be unsolved. If an established service already handles it well, this scores low even when the pain is real.",
  },
  {
    name: "Delusion index",
    points: 10,
    means:
      "How much of this depends on things that will not happen. Ten means every assumption is reasonable. Zero means it needs people to change ingrained habits, or a large incumbent to cooperate.",
  },
];

export default function HowScoringWorksPage() {
  return (
    <LegalLayout
      title="How Scoring Works"
      updated="27 August 2026"
      lede="Every idea gets the same treatment: one read, five questions, no exceptions, and no knowledge of anything beyond the sentence you wrote."
    >
      <section className="legal-section">
        <h2>
          <b>01</b>What actually gets scored
        </h2>
        <p>
          We score how an idea reads in one line, with no context. The
          model sees the one or two sentences you submitted and nothing
          else — no team, no traction, no funding, no market research, no
          idea of whether it already exists as a real, working business.
        </p>
        <p>
          That cuts both ways. A working business can score low if the
          one-line description doesn&rsquo;t make its case. A weak idea
          phrased sharply can still score honestly low, because the
          rubric below scores the idea, not the writing. Nothing here is
          a verdict on you, your execution, or a company you may have
          already built — only on what the sentence itself demonstrates.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>02</b>The five dimensions
        </h2>
        <p>
          100 points, split across five questions. Each is scored
          independently and added together for the total.
        </p>
        {DIMENSIONS.map((d) => (
          <div className="legal-note legal-dim" key={d.name}>
            <p className="legal-dim-head">
              <b>{d.name}</b>
              <span className="legal-dim-points">{d.points} points</span>
            </p>
            <p>{d.means}</p>
          </div>
        ))}
      </section>

      <section className="legal-section">
        <h2>
          <b>03</b>The same idea always returns the same score
        </h2>
        <p>
          Submit the exact same idea text twice and you get the exact
          same score, verdict and breakdown both times — it&rsquo;s
          looked up, not re-guessed. Every score is cached against the
          normalized text of the submission the first time it&rsquo;s
          scored, and every later identical submission returns that same
          stored result, permanently.
        </p>
        <div className="legal-note">
          <p>
            Change the wording — even lightly — and it&rsquo;s a
            different submission to the scorer, so it can land a point
            or two differently even when the underlying idea is the
            same. The guarantee is about the text you actually
            submitted, not every possible way of phrasing it.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <h2>
          <b>04</b>What the score is not
        </h2>
        <p>
          It is not business advice, investment advice, or a valuation.
          It is one automated opinion, produced against a published
          rubric, about how a single sentence reads. Treat it as a blunt
          first reaction, not a verdict on whether to start, keep
          running, or shut down anything.
        </p>
      </section>
    </LegalLayout>
  );
}
