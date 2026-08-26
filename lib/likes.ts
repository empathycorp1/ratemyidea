import { query } from "./db";

export class LikeError extends Error {}

/**
 * Toggles a like: inserts if this (submission, device) and
 * (submission, ip) pair hasn't liked before, deletes if it has. Dedupe
 * is enforced by two separate unique indexes in db/schema.sql — a new
 * row is rejected if EITHER the device or the IP already has one for
 * this idea, so refreshing (which keeps the same device id and IP)
 * can't inflate the count, and neither can clearing localStorage alone
 * (the IP still matches) or switching networks alone (the device id
 * still matches).
 */
export async function toggleLike(
  submissionId: number,
  deviceId: string,
  ip: string
): Promise<{ liked: boolean; likes: number }> {
  const existing = await query<{ id: number }>(
    `SELECT id FROM likes WHERE submission_id = $1 AND (device_id = $2 OR ip = $3)`,
    [submissionId, deviceId, ip]
  );

  if (existing.length > 0) {
    await query(`DELETE FROM likes WHERE id = $1`, [existing[0].id]);
  } else {
    try {
      await query(
        `INSERT INTO likes (submission_id, device_id, ip) VALUES ($1, $2, $3)`,
        [submissionId, deviceId, ip]
      );
    } catch (err) {
      // A concurrent request from the same device/IP won the race and
      // inserted first — treat as already-liked rather than erroring.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("duplicate key")) throw err;
    }
  }

  const countRows = await query<{ count: string }>(
    `SELECT count(*) FROM likes WHERE submission_id = $1`,
    [submissionId]
  );

  const stillLiked = await query<{ id: number }>(
    `SELECT id FROM likes WHERE submission_id = $1 AND device_id = $2`,
    [submissionId, deviceId]
  );

  return {
    liked: stillLiked.length > 0,
    likes: Number(countRows[0]?.count ?? 0),
  };
}
