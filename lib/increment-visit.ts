import { query } from "./db";

/** Counts a real page view of one idea's own page — used for the
 *  Highlight Board's "N visits" figure. Called from app/idea/[id], but
 *  never for the submitter's own pushState transition right after
 *  scoring, since that never hits this server-rendered route at all. */
export async function incrementVisit(id: number): Promise<void> {
  await query(`UPDATE submissions SET visits = visits + 1 WHERE id = $1`, [
    id,
  ]);
}
