/**
 * Kill switch for idea scoring — flip this back to `false` once the
 * Anthropic account has credit again (2026-08-29: it ran out mid-test,
 * see PROGRESS.md's "Deep-dive report" section for the same account
 * hitting this on the report-generation side).
 *
 * Single source of truth, checked in exactly two places:
 * - `components/SubmitForm.tsx` — swaps the submission box for a
 *   paused notice on the homepage (and on a shared `/idea/[id]` view
 *   that falls through to the box, though that path already has a
 *   result and never shows the form regardless).
 * - `app/api/score/route.ts` — returns a clear, non-500 response if
 *   the endpoint is reached directly (e.g. `/test`, which posts to it
 *   too) instead of letting the request through to a real, failing
 *   Anthropic call.
 *
 * Everything else — both boards, idea pages, share cards, stats, the
 * legal pages, likes, presence, the visitor counter — reads nothing
 * from this flag and keeps working exactly as before.
 */
export const SCORING_PAUSED = true;

/** Shown on the homepage in place of the submission box, and echoed
 *  (with different surrounding JSON) by `/api/score`. One string, so
 *  the two surfaces can't drift out of sync while this is flipped on. */
export const SCORING_PAUSED_MESSAGE =
  "Scoring is paused for a few hours while we top up. Everything already scored is still here.";
