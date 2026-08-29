import { query } from "./db";

/**
 * Records this visitor's first visit, if it's genuinely their first —
 * a no-op otherwise (INSERT ... ON CONFLICT DO NOTHING; first_seen is
 * only ever set once, on the real first row). Called once per real
 * page load, from components/VisitTracker.tsx mounted in the root
 * layout — not per page, since the root layout doesn't remount on
 * soft client-side navigations, and idempotent regardless of how many
 * times it's called (a hard reload just no-ops against the existing
 * row).
 *
 * `key` is "device:<id>" for a normal persisted localStorage id, or
 * "ip:<address>" for anyone blocking storage (an ephemeral
 * getDeviceId() fallback — see lib/device-id.ts's isEphemeralDeviceId)
 * — decided by the caller (app/api/visit/route.ts), not here.
 */
export async function recordVisit(key: string): Promise<void> {
  await query(
    `INSERT INTO visitors (visitor_key) VALUES ($1) ON CONFLICT DO NOTHING`,
    [key]
  );
}

export interface VisitorStats {
  count: number;
  /** Whole days elapsed since the earliest row, floored, with a
   *  minimum of 1 — day one reads "1 day", never "0 days". null when
   *  there are no visitors yet (nothing to measure elapsed time from). */
  daysElapsed: number | null;
}

/** Backs the /stats "N visitors in M days" figure. Counting starts
 *  from whenever the `visitors` table was first deployed and began
 *  recording — never backfilled or estimated from an earlier launch
 *  date, so this is exactly what it says: real rows, real timestamps. */
export async function getVisitorStats(): Promise<VisitorStats> {
  const rows = await query<{ count: string; earliest: string | null }>(
    `SELECT count(*) AS count, min(first_seen) AS earliest FROM visitors`
  );
  const row = rows[0];
  const count = Number(row?.count ?? 0);
  if (!row?.earliest) {
    return { count, daysElapsed: null };
  }
  const elapsedMs = Date.now() - new Date(row.earliest).getTime();
  const daysElapsed = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  return { count, daysElapsed };
}
