import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";
import { getStatsData } from "@/lib/get-stats-data";
import "@/app/stats.css";

export const metadata: Metadata = {
  title: "Live Stats · RateMyIdea",
  description:
    "Live numbers from RateMyIdea: ideas scored, revenue, the highest scores, and how the Merit Board's best idea compares to the Highlight Board's biggest spender.",
};

// Every number here comes from a query run for THIS request — never a
// cached snapshot. Same reasoning as every other DB-reading page (see
// PROGRESS.md): without force-dynamic, Next's classic caching model
// would silently prerender this once and freeze it, which is exactly
// what a stats page must never do.
export const dynamic = "force-dynamic";

function formatWholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatCentsAsDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLiveTimestamp(d: Date): string {
  const time = d.toISOString().slice(11, 19);
  const day = d.getUTCDate();
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${time} UTC on ${day} ${month} ${year}`;
}

export default async function StatsPage() {
  const stats = await getStatsData();
  const maxBand = Math.max(1, ...stats.distribution.map((b) => b.count));
  const maxCategory = Math.max(1, ...stats.categories.map((c) => c.count));

  const hasMerit = stats.highestScoreEver !== null;
  const hasMoney = stats.activeHighlightCount > 0;

  return (
    <LegalLayout
      title="Live Stats"
      updated={formatLiveTimestamp(new Date())}
      updatedLabel="Live as of"
      lede="Every number on this page is a fresh query, run the moment you loaded it — not a cached snapshot from earlier."
    >
      {/* The headline: how far apart the two boards' toppers are. This
          contrast — one idea winning on merit, a different one winning
          on money — is the whole premise of having two boards. */}
      <div
        className={`stats-headline${!hasMerit && !hasMoney ? " stats-headline-empty" : ""}`}
      >
        <div className="stats-headline-half merit">
          <div className="stats-headline-label">Ranked #1 by merit</div>
          <div className="stats-headline-value">
            {hasMerit ? stats.highestScoreEver : "—"}
          </div>
          <div className="stats-headline-sub">
            {hasMerit
              ? "highest score on the Merit Board"
              : "Nothing scored yet"}
          </div>
        </div>
        <div className="stats-headline-half money">
          <div className="stats-headline-label">Ranked #1 by money</div>
          <div className="stats-headline-value">
            {hasMoney ? `$${stats.topHighlightAmount.toLocaleString("en-US")}` : "—"}
          </div>
          <div className="stats-headline-sub">
            {hasMoney
              ? "top Highlight Board placement"
              : "Nothing highlighted yet"}
          </div>
        </div>
      </div>

      <section className="legal-section">
        <h2>
          <b>01</b>Right now
        </h2>
        <div className="stats-grid">
          <div className="stats-tile">
            <div className="stats-tile-label">Here now</div>
            <div className={`stats-tile-value${stats.hereNow === 0 ? " empty" : ""}`}>
              {stats.hereNow}
            </div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Scored today</div>
            <div className={`stats-tile-value${stats.scoredToday === 0 ? " empty" : ""}`}>
              {stats.scoredToday}
            </div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Scored, all time</div>
            <div className={`stats-tile-value${stats.scoredTotal === 0 ? " empty" : ""}`}>
              {stats.scoredTotal}
            </div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Highest score today</div>
            <div
              className={`stats-tile-value${stats.highestScoreToday === null ? " empty" : ""}`}
            >
              {stats.highestScoreToday ?? "—"}
            </div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Highest score ever</div>
            <div
              className={`stats-tile-value${stats.highestScoreEver === null ? " empty" : ""}`}
            >
              {stats.highestScoreEver ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="legal-section">
        <h2>
          <b>02</b>Revenue
        </h2>
        <div className="stats-grid">
          <div className="stats-tile">
            <div className="stats-tile-label">Gross</div>
            <div
              className={`stats-tile-value${stats.revenue.grossCents === 0 ? " empty" : ""}`}
            >
              {formatWholeDollars(stats.revenue.grossCents)}
            </div>
            <div className="stats-tile-note">total paid for active placements</div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Net, after fees</div>
            <div
              className={`stats-tile-value${stats.revenue.netCents === 0 ? " empty" : ""}`}
            >
              {formatCentsAsDollars(stats.revenue.netCents)}
            </div>
            <div className="stats-tile-note">after Dodo&rsquo;s cut</div>
          </div>
        </div>
        <p className="stats-fee-note">
          Dodo Payments charges 4% + $0.40 per transaction. Net is
          calculated per placement (
          {stats.activeHighlightCount === 1
            ? "the one active placement"
            : `all ${stats.activeHighlightCount} active placements`}
          ) and summed, not estimated from the total.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>03</b>The Highlight Board
        </h2>
        <div className="stats-grid">
          <div className="stats-tile">
            <div className="stats-tile-label">Active placements</div>
            <div
              className={`stats-tile-value${stats.activeHighlightCount === 0 ? " empty" : ""}`}
            >
              {stats.activeHighlightCount}
            </div>
          </div>
          <div className="stats-tile">
            <div className="stats-tile-label">Current top amount</div>
            <div
              className={`stats-tile-value${stats.topHighlightAmount === 0 ? " empty" : ""}`}
            >
              {stats.topHighlightAmount > 0
                ? `$${stats.topHighlightAmount.toLocaleString("en-US")}`
                : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="legal-section">
        <h2>
          <b>04</b>Score distribution
        </h2>
        {stats.scoredTotal === 0 ? (
          <p className="stats-empty-note">
            No ideas scored yet — every band below will fill in as
            submissions come in.
          </p>
        ) : (
          <p className="stats-empty-note">
            {stats.scoredTotal} scored idea{stats.scoredTotal === 1 ? "" : "s"},
            grouped by band of ten.
          </p>
        )}
        <div className="stats-bars">
          {stats.distribution.map((band) => (
            <div className="stats-bar-row" key={band.label}>
              <div className="stats-bar-label">{band.label}</div>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{
                    width: `${(band.count / maxBand) * 100}%`,
                  }}
                />
              </div>
              <div className="stats-bar-count">{band.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="legal-section">
        <h2>
          <b>05</b>Ideas per category
        </h2>
        {stats.scoredTotal === 0 ? (
          <p className="stats-empty-note">
            No ideas scored yet — all sixteen categories start at zero.
          </p>
        ) : (
          <p className="stats-empty-note">Every category, most active first.</p>
        )}
        <div className="stats-bars">
          {stats.categories.map((cat) => (
            <div className="stats-bar-row stats-cat-row" key={cat.value}>
              <div className="stats-bar-label">{cat.label}</div>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{
                    width: `${(cat.count / maxCategory) * 100}%`,
                  }}
                />
              </div>
              <div className="stats-bar-count">{cat.count}</div>
            </div>
          ))}
        </div>
      </section>
    </LegalLayout>
  );
}
