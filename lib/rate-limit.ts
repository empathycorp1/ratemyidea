import { query } from "./db";

const PER_IP_PER_MINUTE = 5;
const PER_IP_PER_DAY = 30;

/** Global daily cap on fresh (non-cached) API calls. Configurable via
 *  DAILY_SCORE_CAP in .env.local; defaults to 2000 if unset or invalid. */
const GLOBAL_PER_DAY = (() => {
  const raw = Number(process.env.DAILY_SCORE_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 2000;
})();

/** Thrown when a caller has hit a rate limit. The message is meant to
 *  be shown to the user as-is — see app/api/score/route.ts. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

async function countSince(ip: string | null, interval: string): Promise<number> {
  const rows = ip
    ? await query<{ count: string }>(
        `SELECT count(*) FROM scoring_attempts
         WHERE ip = $1 AND created_at > now() - $2::interval`,
        [ip, interval]
      )
    : await query<{ count: string }>(
        `SELECT count(*) FROM scoring_attempts
         WHERE created_at > now() - $1::interval`,
        [interval]
      );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Checks per-IP and global rate limits, and — only if the caller is
 * within them — records this attempt. Throws RateLimitError otherwise.
 *
 * Only call this on a confirmed cache MISS: cached hits don't call the
 * model, cost nothing, and must never count against either limit.
 *
 * This is not perfectly race-free under heavy concurrent traffic (two
 * requests could both pass the check just before either one records
 * its attempt), but it's a solid v1 guard against the actual threats
 * here — a script hammering the endpoint, or a runaway API bill — not
 * a distributed rate limiter under adversarial load.
 */
export async function checkAndRecordAttempt(ip: string): Promise<void> {
  const perMinute = await countSince(ip, "1 minute");
  if (perMinute >= PER_IP_PER_MINUTE) {
    throw new RateLimitError(
      "You're submitting ideas faster than we can score them. Wait a minute and try again."
    );
  }

  const perDay = await countSince(ip, "1 day");
  if (perDay >= PER_IP_PER_DAY) {
    throw new RateLimitError(
      "You've reached today's limit for scoring ideas. Try again tomorrow."
    );
  }

  const globalPerDay = await countSince(null, "1 day");
  if (globalPerDay >= GLOBAL_PER_DAY) {
    throw new RateLimitError(
      "RateMyIdea has hit its scoring limit for today. Please check back tomorrow."
    );
  }

  await query(`INSERT INTO scoring_attempts (ip) VALUES ($1)`, [ip]);
}
