import { query } from "./db";

export interface MeritRow {
  id: number;
  total: number;
  ideaText: string;
  category: string;
  likes: number;
  likedByMe: boolean;
}

export interface HighlightRow {
  id: number;
  submissionId: number;
  initial: string;
  ideaText: string;
  category: string;
  amount: number;
  visits: number;
}

export interface LiveStats {
  hereNow: number;
  totalScored: number;
  totalEarned: number;
}

function truncateForBoard(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

/**
 * All scored ideas, ranked by score, for the Merit Board. `deviceId` is
 * optional — when given, each row reports whether that device has
 * already liked it, so the heart can render its .on state on first
 * paint instead of only after a client round-trip.
 *
 * Fetched in full (not paginated) — real category/range filtering
 * happens client-side in RateMyIdeaApp, mirroring how
 * homepage-prototype.html's BOARD array worked. At today's data volume
 * (low hundreds of rows) that's a small, cheap payload; this will need
 * real server-side pagination well before it doesn't.
 */
export async function getMeritBoardRows(
  deviceId?: string
): Promise<MeritRow[]> {
  const rows = await query<{
    id: number;
    total: number;
    idea_text: string;
    category: string;
    likes: string;
    liked_by_me: boolean;
  }>(
    `SELECT
       s.id,
       s.total,
       s.idea_text,
       s.category,
       (SELECT count(*) FROM likes l WHERE l.submission_id = s.id) AS likes,
       EXISTS(
         SELECT 1 FROM likes l
         WHERE l.submission_id = s.id AND l.device_id = $1
       ) AS liked_by_me
     FROM submissions s
     ORDER BY s.total DESC, s.id ASC`,
    [deviceId ?? ""]
  );

  return rows.map((r) => ({
    id: r.id,
    total: r.total,
    ideaText: truncateForBoard(r.idea_text, 140),
    category: r.category,
    likes: Number(r.likes),
    likedByMe: r.liked_by_me,
  }));
}

/**
 * Whatever is currently featured on the Highlight Board, ranked by
 * amount paid. Only 'active' rows count — a placement is live only once
 * the Dodo webhook has confirmed payment (see
 * app/api/dodo/webhook/route.ts); 'pending'/'refunded'/'failed' rows
 * never appear here. Ties (equal amount) break by created_at ASC,
 * matching terms.html §05: "where two placements hold equal amounts,
 * the one paid for earlier ranks higher."
 */
export async function getHighlightBoardRows(): Promise<HighlightRow[]> {
  const rows = await query<{
    id: number;
    submission_id: number;
    idea_text: string;
    category: string;
    amount_cents: number;
    visits: number;
  }>(
    `SELECT
       h.id,
       h.submission_id,
       s.idea_text,
       s.category,
       h.amount_cents,
       s.visits
     FROM highlights h
     JOIN submissions s ON s.id = h.submission_id
     WHERE h.status = 'active'
     ORDER BY h.amount_cents DESC, h.created_at ASC`
  );

  return rows.map((r) => ({
    id: r.id,
    submissionId: r.submission_id,
    initial: r.idea_text.trim().charAt(0).toUpperCase() || "?",
    ideaText: truncateForBoard(r.idea_text, 140),
    category: r.category,
    // Amounts are always whole dollars at checkout time (see
    // app/api/highlight/checkout/route.ts), so this division is exact.
    amount: r.amount_cents / 100,
    visits: r.visits,
  }));
}

/** Highest current (active) highlight amount, for the claim strip's
 *  "$X takes the top spot" line — 0 if nothing is highlighted yet. */
export async function getTopHighlightAmount(): Promise<number> {
  const rows = await query<{ max: number | null }>(
    `SELECT max(amount_cents) AS max FROM highlights WHERE status = 'active'`
  );
  return Math.round((rows[0]?.max ?? 0) / 100);
}

export async function getLiveStats(): Promise<LiveStats> {
  const rows = await query<{
    here_now: string;
    total_scored: string;
    total_earned: string;
  }>(
    `SELECT
       (SELECT count(*) FROM presence WHERE last_seen > now() - interval '60 seconds') AS here_now,
       (SELECT count(*) FROM submissions) AS total_scored,
       (SELECT coalesce(sum(amount_cents), 0) FROM highlights WHERE status = 'active') AS total_earned`
  );
  const row = rows[0];
  return {
    hereNow: Number(row?.here_now ?? 0),
    totalScored: Number(row?.total_scored ?? 0),
    totalEarned: Math.round(Number(row?.total_earned ?? 0) / 100),
  };
}
