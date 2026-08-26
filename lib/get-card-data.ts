import { query } from "./db";
import type { ScoreBreakdown } from "./types";

export interface CardData {
  ideaText: string;
  verdict: string;
  total: number;
  category: string;
  scores: ScoreBreakdown;
  rank: number;
  totalSubmissions: number;
}

/**
 * Everything the share card (app/api/card/[id]/route.tsx) and the
 * result page (components/RateMyIdeaApp.tsx, via app/idea/[id]/page.tsx)
 * need for one scored idea, including its live Merit Board rank —
 * computed on the fly from the submissions table rather than stored,
 * since rank shifts as new ideas get scored. Standard competition
 * ranking: ties share a rank, the next distinct (lower) score skips
 * accordingly.
 */
export async function getCardData(id: number): Promise<CardData | null> {
  const rows = await query<{
    idea_text: string;
    verdict: string;
    total: number;
    category: string;
    originality: number;
    willingness_to_pay: number;
    weekend_copy_risk: number;
    real_problem: number;
    delusion_index: number;
    rank: string;
    total_submissions: string;
  }>(
    `SELECT
       s.idea_text,
       s.verdict,
       s.total,
       s.category,
       s.originality,
       s.willingness_to_pay,
       s.weekend_copy_risk,
       s.real_problem,
       s.delusion_index,
       (SELECT count(*) FROM submissions WHERE total > s.total) + 1 AS rank,
       (SELECT count(*) FROM submissions) AS total_submissions
     FROM submissions s
     WHERE s.id = $1`,
    [id]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    ideaText: row.idea_text,
    verdict: row.verdict,
    total: row.total,
    category: row.category,
    scores: {
      originality: row.originality,
      willingness_to_pay: row.willingness_to_pay,
      weekend_copy_risk: row.weekend_copy_risk,
      real_problem: row.real_problem,
      delusion_index: row.delusion_index,
    },
    rank: Number(row.rank),
    totalSubmissions: Number(row.total_submissions),
  };
}

/**
 * Just the rank half of the above, for a total that's already known
 * (used right after scoring a fresh idea in lib/score-idea.ts, where
 * fetching the idea row again would be redundant).
 */
export async function getRankInfo(
  total: number
): Promise<{ rank: number; totalSubmissions: number }> {
  const rows = await query<{ rank: string; total_submissions: string }>(
    `SELECT
       (SELECT count(*) FROM submissions WHERE total > $1) + 1 AS rank,
       (SELECT count(*) FROM submissions) AS total_submissions`,
    [total]
  );
  return {
    rank: Number(rows[0]?.rank ?? 1),
    totalSubmissions: Number(rows[0]?.total_submissions ?? 0),
  };
}
