import Anthropic from "@anthropic-ai/sdk";
import { ALLOWED_CATEGORIES } from "./categories";
import { query } from "./db";
import { getRankInfo } from "./get-card-data";
import { hashIdea, normalizeIdea } from "./normalize";
import { checkAndRecordAttempt } from "./rate-limit";
import { SCORING_PROMPT_VERSION, SCORING_SYSTEM_PROMPT } from "./scoring-prompt";
import type { RawScoreResult, ScoreBreakdown, ScoreResult } from "./types";

const ZERO_SCORES: ScoreBreakdown = {
  originality: 0,
  willingness_to_pay: 0,
  weekend_copy_risk: 0,
  real_problem: 0,
  delusion_index: 0,
};

const MODEL = "claude-haiku-4-5-20251001";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Removes ```json fences (or bare ```), if the model added any. */
function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function callModelOnce(ideaText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0,
    system: SCORING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: ideaText }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Model response did not contain a text block.");
  }
  return block.text;
}

/**
 * Calls the model, retrying twice with backoff on failure (3 attempts
 * total), per scoring-spec.md's "API call fails" failure-handling rule.
 */
async function callModelWithRetries(ideaText: string): Promise<string> {
  const backoffMs = [0, 500, 1500];
  let lastError: unknown;

  for (const delay of backoffMs) {
    if (delay > 0) await sleep(delay);
    try {
      return await callModelOnce(ideaText);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Anthropic API call failed after 3 attempts: ${String(lastError)}`
  );
}

/**
 * If the model returns a category outside the permitted list, coerce it
 * to "other" and log a warning rather than failing the whole request —
 * an unrecognized category is a labeling problem, not a reason to
 * throw away an otherwise-valid score.
 */
function normalizeCategory(category: string): string {
  if (ALLOWED_CATEGORIES.has(category)) return category;
  console.warn(
    `[scoring] model returned an invalid category "${category}"; coercing to "other".`
  );
  return "other";
}

function shapeIsValid(data: unknown): data is RawScoreResult {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  const baseShapeOk =
    typeof d.valid === "boolean" &&
    typeof d.flagged === "boolean" &&
    typeof d.total === "number" &&
    typeof d.verdict === "string";

  if (!baseShapeOk) return false;

  // Per scoring-spec.md: "If valid is false or flagged is true, set
  // score to 0 and leave the verdict empty." That's a correct response,
  // not a malformed one — there's nothing to categorize or break down,
  // so the model reasonably sends `category: null` and no scores object.
  // Don't require either here.
  if (!d.valid || d.flagged) return true;

  const scores = d.scores as Record<string, unknown> | undefined;
  return (
    typeof d.category === "string" &&
    !!scores &&
    typeof scores.originality === "number" &&
    typeof scores.willingness_to_pay === "number" &&
    typeof scores.weekend_copy_risk === "number" &&
    typeof scores.real_problem === "number" &&
    typeof scores.delusion_index === "number"
  );
}

/**
 * Calls the model and returns a validated, spec-shaped result.
 * Handles the "Malformed JSON returned" and "total does not match
 * the sum" failure-handling rules from scoring-spec.md.
 */
async function getFreshScore(ideaText: string): Promise<RawScoreResult> {
  let raw = await callModelWithRetries(ideaText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripMarkdownFences(raw));
  } catch {
    // Malformed JSON: retry the whole call once more.
    raw = await callModelWithRetries(ideaText);
    try {
      parsed = JSON.parse(stripMarkdownFences(raw));
    } catch {
      throw new Error(
        "Model returned malformed JSON twice in a row; treating as an API failure."
      );
    }
  }

  if (!shapeIsValid(parsed)) {
    console.error(
      "[scoring] response failed shape validation. Raw model response:",
      raw
    );
    throw new Error("Model response did not match the expected shape.");
  }

  const result = parsed;

  // Invalid or flagged submissions have no real five-dimension breakdown
  // to check (see shapeIsValid above) — nothing to recompute here.
  // Fill in a zeroed breakdown so `scores` is always a real object.
  if (!result.valid || result.flagged) {
    return {
      ...result,
      category: typeof result.category === "string" ? result.category : "",
      scores: result.scores ?? ZERO_SCORES,
    };
  }

  const recomputedTotal =
    result.scores.originality +
    result.scores.willingness_to_pay +
    result.scores.weekend_copy_risk +
    result.scores.real_problem +
    result.scores.delusion_index;

  if (recomputedTotal !== result.total) {
    console.warn(
      `[scoring] total mismatch for a submission: model said ${result.total}, ` +
        `components summed to ${recomputedTotal}. Using the recomputed value.`
    );
    result.total = recomputedTotal;
  }

  result.category = normalizeCategory(result.category);

  return result;
}

type CachedRow = {
  id: number;
  category: string;
  originality: number;
  willingness_to_pay: number;
  weekend_copy_risk: number;
  real_problem: number;
  delusion_index: number;
  total: number;
  verdict: string;
};

/**
 * The main entry point: normalize + hash the idea, check the database
 * for that hash, and only call the Anthropic API if there's no match.
 *
 * `ip` is used purely for rate limiting (see lib/rate-limit.ts) and is
 * only consulted on a cache miss — cache hits never call the model, so
 * they never count against any limit.
 */
export async function scoreIdea(
  ideaText: string,
  ip: string
): Promise<ScoreResult> {
  const normalized = normalizeIdea(ideaText);
  const hash = hashIdea(normalized);

  const existing = await query<CachedRow>(
    `SELECT id, category, originality, willingness_to_pay, weekend_copy_risk,
            real_problem, delusion_index, total, verdict
     FROM submissions
     WHERE normalized_hash = $1
     LIMIT 1`,
    [hash]
  );

  if (existing.length > 0) {
    const row = existing[0];
    // Rank is computed fresh even on a cache hit: the score is
    // immutable, but its standing among other ideas isn't.
    const { rank, totalSubmissions } = await getRankInfo(row.total);
    return {
      valid: true,
      flagged: false,
      category: row.category,
      scores: {
        originality: row.originality,
        willingness_to_pay: row.willingness_to_pay,
        weekend_copy_risk: row.weekend_copy_risk,
        real_problem: row.real_problem,
        delusion_index: row.delusion_index,
      },
      total: row.total,
      verdict: row.verdict,
      cached: true,
      id: row.id,
      rank,
      totalSubmissions,
    };
  }

  await checkAndRecordAttempt(ip);

  const result = await getFreshScore(ideaText);
  let id: number | null = null;

  // Per scoring-spec.md: flagged submissions are never stored — no text,
  // no result. Invalid-but-unflagged ones (gibberish, prompt-injection
  // attempts) also aren't cached, since this table is destined to back
  // public idea pages and the Merit Board later.
  if (result.valid && !result.flagged) {
    const inserted = await query<{ id: number }>(
      `INSERT INTO submissions
         (idea_text, normalized_hash, originality, willingness_to_pay,
          weekend_copy_risk, real_problem, delusion_index, total, verdict,
          category, prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (normalized_hash) DO NOTHING
       RETURNING id`,
      [
        ideaText,
        hash,
        result.scores.originality,
        result.scores.willingness_to_pay,
        result.scores.weekend_copy_risk,
        result.scores.real_problem,
        result.scores.delusion_index,
        result.total,
        result.verdict,
        result.category,
        SCORING_PROMPT_VERSION,
      ]
    );

    if (inserted.length > 0) {
      id = inserted[0].id;
    } else {
      // ON CONFLICT DO NOTHING returns no row when a concurrent request
      // already inserted this exact hash first — look up its id instead
      // of leaving this response without one.
      const raced = await query<{ id: number }>(
        `SELECT id FROM submissions WHERE normalized_hash = $1`,
        [hash]
      );
      id = raced[0]?.id ?? null;
    }
  }

  const rankInfo = id !== null ? await getRankInfo(result.total) : null;

  return {
    ...result,
    cached: false,
    id,
    rank: rankInfo?.rank ?? null,
    totalSubmissions: rankInfo?.totalSubmissions ?? null,
  };
}
