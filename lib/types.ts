export interface ScoreBreakdown {
  originality: number;
  willingness_to_pay: number;
  weekend_copy_risk: number;
  real_problem: number;
  delusion_index: number;
}

/** Shape returned by the model, per scoring-spec.md's "Output" section. */
export interface RawScoreResult {
  valid: boolean;
  flagged: boolean;
  category: string;
  scores: ScoreBreakdown;
  total: number;
  verdict: string;
}

/** What our own scoreIdea() function returns — the raw shape plus a
 *  cached flag so callers (like the test page) can see whether this
 *  came from the database or from a fresh API call, the row's database
 *  id, and its live Merit Board rank. All three are null for
 *  invalid/flagged submissions, which are never stored — there's
 *  nothing to link to or rank for those. Rank is always computed
 *  fresh, even on a cache hit, since the score is immutable but its
 *  standing among other ideas isn't. */
export interface ScoreResult extends RawScoreResult {
  cached: boolean;
  id: number | null;
  rank: number | null;
  totalSubmissions: number | null;
}
