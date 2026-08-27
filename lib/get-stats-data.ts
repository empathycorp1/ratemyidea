import { query } from "./db";
import { CATEGORY_VALUES, CATEGORY_LABELS } from "./categories";

// Dodo's own per-transaction fee, applied to figure out net revenue —
// see terms.html §06 / the checkout flow: Dodo is merchant of record,
// so this is what actually lands in the account, not what was charged.
// This must be computed per transaction, not once over the total: the
// fixed $0.40 applies to each placement individually, not once overall.
const DODO_FEE_PERCENT = 0.04;
const DODO_FEE_FIXED_CENTS = 40;

export interface ScoreBand {
  label: string;
  count: number;
}

export interface CategoryCount {
  value: string;
  label: string;
  count: number;
}

export interface StatsData {
  hereNow: number;
  scoredToday: number;
  scoredTotal: number;
  highestScoreToday: number | null;
  highestScoreEver: number | null;
  revenue: {
    grossCents: number;
    netCents: number;
  };
  activeHighlightCount: number;
  topHighlightAmount: number; // dollars
  distribution: ScoreBand[]; // always 10 entries, 0 through 9 bands
  categories: CategoryCount[]; // always all 16 canonical categories
}

/** Everything /stats needs, in one place — see app/stats/page.tsx,
 *  which is force-dynamic specifically so every one of these numbers
 *  is a fresh query on every load, never a cached/stale snapshot. */
export async function getStatsData(): Promise<StatsData> {
  const [activity, revenueRow, highlightRow, distributionRows, categoryRows] =
    await Promise.all([
      query<{
        here_now: string;
        scored_today: string;
        scored_total: string;
        highest_today: number | null;
        highest_ever: number | null;
      }>(
        `SELECT
           (SELECT count(*) FROM presence WHERE last_seen > now() - interval '60 seconds') AS here_now,
           (SELECT count(*) FROM submissions WHERE created_at >= date_trunc('day', now())) AS scored_today,
           (SELECT count(*) FROM submissions) AS scored_total,
           (SELECT max(total) FROM submissions WHERE created_at >= date_trunc('day', now())) AS highest_today,
           (SELECT max(total) FROM submissions) AS highest_ever`
      ),
      // Per-row fee math, then summed — NOT (sum * 0.96 - 0.40), which
      // would only be correct for a single transaction. Only 'active'
      // placements count, matching every other revenue figure on the
      // site (a refunded placement was never really kept).
      query<{ gross_cents: string; net_cents: string }>(
        `SELECT
           coalesce(sum(amount_cents), 0) AS gross_cents,
           coalesce(sum(amount_cents - round(amount_cents * $1::numeric) - $2::int), 0) AS net_cents
         FROM highlights
         WHERE status = 'active'`,
        [DODO_FEE_PERCENT, DODO_FEE_FIXED_CENTS]
      ),
      query<{ count: string; top_amount_cents: number | null }>(
        `SELECT count(*) AS count, max(amount_cents) AS top_amount_cents
         FROM highlights
         WHERE status = 'active'`
      ),
      // Integer division buckets into tens; LEAST(...,9) folds a
      // (possible, if the rubric is ever recalibrated upward) score of
      // 100 into the same top band as 90–99, matching the requested
      // "90–100" label rather than creating an eleventh band for one
      // value.
      query<{ band: number; count: string }>(
        `SELECT LEAST(total / 10, 9) AS band, count(*) AS count
         FROM submissions
         GROUP BY band`
      ),
      query<{ category: string; count: string }>(
        `SELECT category, count(*) AS count
         FROM submissions
         GROUP BY category`
      ),
    ]);

  const a = activity[0];
  const rev = revenueRow[0];
  const hl = highlightRow[0];

  const bandCounts = new Array(10).fill(0);
  for (const row of distributionRows) {
    bandCounts[Number(row.band)] = Number(row.count);
  }
  const bandLabels = [
    "0–9",
    "10–19",
    "20–29",
    "30–39",
    "40–49",
    "50–59",
    "60–69",
    "70–79",
    "80–89",
    "90–100",
  ];
  const distribution: ScoreBand[] = bandLabels.map((label, i) => ({
    label,
    count: bandCounts[i],
  }));

  const categoryCountMap = new Map(
    categoryRows.map((r) => [r.category, Number(r.count)])
  );
  const categories: CategoryCount[] = CATEGORY_VALUES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
    count: categoryCountMap.get(value) ?? 0,
  })).sort((x, y) => y.count - x.count);

  return {
    hereNow: Number(a?.here_now ?? 0),
    scoredToday: Number(a?.scored_today ?? 0),
    scoredTotal: Number(a?.scored_total ?? 0),
    highestScoreToday: a?.highest_today ?? null,
    highestScoreEver: a?.highest_ever ?? null,
    revenue: {
      grossCents: Number(rev?.gross_cents ?? 0),
      netCents: Number(rev?.net_cents ?? 0),
    },
    activeHighlightCount: Number(hl?.count ?? 0),
    topHighlightAmount: Math.round(Number(hl?.top_amount_cents ?? 0) / 100),
    distribution,
    categories,
  };
}
