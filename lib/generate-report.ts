import Anthropic from "@anthropic-ai/sdk";
import { getCardData } from "./get-card-data";
import { REPORT_SYSTEM_PROMPT } from "./report-prompt";
import type { ScoreBreakdown } from "./types";

// Sonnet, not Haiku — explicit instruction: this is a paid deliverable
// and quality matters more than cost. "claude-sonnet-5" is the current
// model id (not a dated snapshot — see the claude-api skill's model
// table; dated ids like claude-sonnet-4-6-20251114 are stale training
// priors, not real ids to construct).
const MODEL = "claude-sonnet-5";

// Generous headroom for ~1,500 words of prose plus JSON structure and
// whatever reasoning happens between search calls — better to have
// unused ceiling than truncate mid-report. Streaming (not .create())
// specifically because a 30-60s budget with an 8000-token ceiling and
// server-tool round-trips is exactly the shape the SDK's own docs warn
// can hit a non-streaming HTTP timeout.
const MAX_TOKENS = 8000;

// A handful of searches — a few competitor lookups plus one or two
// general-market queries. Tuned down from an initial 8 after real
// testing: 8 sequential searches at effort "high" measured 3-5 minutes
// per report, well past the 30-60s target — each search is a real
// network round trip, and they add up fast. 5 is the balance between
// still genuinely verifying named competitors and actually landing
// near budget; see the effort setting below for the other half of the
// same tradeoff.
const MAX_SEARCH_USES = 5;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReportDimension {
  name: string;
  reasoning: string;
}

export interface ReportCompetitor {
  name: string;
  description: string;
  verified: boolean;
  sourceUrl: string | null;
}

export interface ReportTest {
  order: number;
  test: string;
  killResult: string;
}

export interface ReportSource {
  url: string;
  title: string;
  /** The search query that surfaced this result, when it could be
   *  determined from the tool-use block that preceded it. */
  query: string | null;
}

export interface DeepDiveReportContent {
  page1: {
    ideaRestated: string;
    dimensions: ReportDimension[];
    biggestWeakness: { title: string; argument: string };
  };
  page2: {
    existingPlayers: ReportCompetitor[];
    noPlayersFoundNote: string | null;
    realisticFirstCustomer: string;
    currentAlternative: string;
    switchRationale: { wouldSwitch: boolean; argument: string };
  };
  page3: {
    strongestVersion: string;
    testsToRun: ReportTest[];
    scoreMoverEvidence: string;
    rewrittenPitch: string;
  };
}

/** The full report: the model's analytical content (DeepDiveReportContent)
 *  plus factual metadata injected server-side from the database — never
 *  let the model be the source of truth for the idea's actual text,
 *  category, or score, only for the writing built on top of them. */
export interface DeepDiveReport extends DeepDiveReportContent {
  submissionId: number;
  ideaText: string;
  category: string;
  scores: ScoreBreakdown;
  totalScore: number;
  verdict: string;
  generatedAt: string;
  model: string;
  /** Real search results actually returned during generation — extracted
   *  from the response's own web_search_tool_result blocks, not
   *  self-reported by the model. A second, code-verified signal that
   *  search genuinely ran, independent of what page2.existingPlayers
   *  claims about itself. */
  sources: ReportSource[];
  approxWordCount: number;
}

const DIMENSION_ORDER = [
  "Originality",
  "Willingness to pay",
  "Weekend copy risk",
  "Real problem",
  "Delusion index",
] as const;

// Structural verification: after generation, every named company must
// be checked against the ACTUAL search results the response contains —
// never trust the model's own "verified" self-report. See
// sanitizeAndVerify() below. Found and fixed after a real failure: a
// mid-score report (submission 17, 2026-08-29) had real, relevant
// search hits (Intelligems, Triple Whale) sitting in its own
// web_search_tool_result blocks, but shipped an empty existingPlayers
// array and falsely claimed "web search was unavailable" — this whole
// block exists to catch exactly that class of failure in code, not
// just discourage it in the prompt.

function normalizeDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    // "www.triplewhale.com" -> "triplewhale" — the registrable label,
    // not the full host, so a result under a different subdomain of
    // the same site still matches.
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return null;
  }
}

// Generic platforms/aggregators/press outlets — showing up in search
// results doesn't mean "a named competitor was found," so these are
// excluded from findLikelyMissedCompetitor()'s heuristic below.
const GENERIC_HOSTS = new Set([
  "wikipedia",
  "youtube",
  "google",
  "quora",
  "reddit",
  "linkedin",
  "medium",
  "substack",
  "gumroad",
  "facebook",
  "twitter",
  "instagram",
  "tiktok",
  "businesswire",
  "techcrunch",
  "forbes",
  "crunchbase",
  "shopify",
  "stackshare",
  "goodreads",
]);

/**
 * Best-effort signal that search returned a real, specifically-named
 * result the report should have cited but didn't — the exact id-17
 * failure mode. A search query that's clearly hunting one branded
 * entity (its normalized text contains that entity's domain) whose
 * result actually came back is strong evidence of a genuine hit. This
 * is a *trigger for a retry*, not the final word on validity —
 * sanitizeAndVerify() still requires the model to name and cite it
 * correctly before it ships.
 */
function findLikelyMissedCompetitor(
  sources: ReportSource[]
): ReportSource | null {
  for (const s of sources) {
    if (!s.query) continue;
    const domain = normalizeDomain(s.url);
    if (!domain || domain.length < 4 || GENERIC_HOSTS.has(domain)) continue;
    const normalizedQuery = s.query.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalizedQuery.includes(domain)) return s;
  }
  return null;
}

/**
 * Matches a claim that the search *tool itself* was unavailable or
 * broken — not a legitimate "I searched and found nothing relevant"
 * finding, which is a different, allowed claim and shouldn't trip
 * this. This is the literal false claim seen during testing: "Live web
 * search was unavailable during this session's research pass," while
 * the same response's own tool-result blocks held real results.
 */
function claimsSearchUnavailable(note: string): boolean {
  return /search\s+(?:tool\s+)?(?:was|is|were)?\s*(?:currently\s+)?(unavailable|not available|down|inaccessible|didn'?t work|could not (?:be )?(?:performed|completed|run)|failed to (?:run|return|load))/i.test(
    note
  );
}

interface VerificationResult {
  ok: boolean;
  reason?: string;
  strippedNames: string[];
}

/**
 * Mutates content.page2.existingPlayers in place, keeping only entries
 * whose sourceUrl's domain actually appears among the real search
 * results — everything else is stripped (fabricated URL, or a
 * `verified: false` entry named against instructions; neither can map
 * to a real source by definition). Then checks the two structural
 * failure conditions requested: existingPlayers ending up empty when a
 * likely real competitor was sitting in the search results, and a
 * false "search was unavailable" claim made alongside real results.
 * Returns ok: false with a reason in either case — the caller retries
 * on failure, it does not ship a partially-sanitized report as a
 * silent success.
 */
function sanitizeAndVerify(
  content: DeepDiveReportContent,
  sources: ReportSource[]
): VerificationResult {
  const realDomains = new Set(
    sources
      .map((s) => normalizeDomain(s.url))
      .filter((d): d is string => d !== null)
  );

  const originalCount = content.page2.existingPlayers.length;
  const strippedNames: string[] = [];
  content.page2.existingPlayers = content.page2.existingPlayers.filter(
    (p) => {
      const domain = p.sourceUrl ? normalizeDomain(p.sourceUrl) : null;
      const mapped = domain !== null && realDomains.has(domain);
      if (!mapped) strippedNames.push(p.name);
      return mapped;
    }
  );

  if (content.page2.existingPlayers.length === 0) {
    if (originalCount > 0) {
      return {
        ok: false,
        reason: `all ${originalCount} named compan${originalCount === 1 ? "y" : "ies"} failed source verification (${strippedNames.join(", ")}) — none map to a real search result URL`,
        strippedNames,
      };
    }
    const missed = findLikelyMissedCompetitor(sources);
    if (missed) {
      return {
        ok: false,
        reason: `existingPlayers is empty, but search returned a likely competitor result: "${missed.title}" (${missed.url})`,
        strippedNames,
      };
    }
  }

  if (
    content.page2.noPlayersFoundNote &&
    sources.length > 0 &&
    claimsSearchUnavailable(content.page2.noPlayersFoundNote)
  ) {
    return {
      ok: false,
      reason: `noPlayersFoundNote claims search was unavailable, but ${sources.length} real search results exist`,
      strippedNames,
    };
  }

  return { ok: true, strippedNames };
}

function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Extracts the JSON object embedded in model output that may carry
 * stray prose around it — a preamble ("Here's the report:"), trailing
 * commentary after the closing brace, or both, in addition to markdown
 * fences. Takes the substring from the first `{` to the last `}`
 * rather than trusting the whole string to be pure JSON: an LLM
 * writing after tool use doesn't reliably stay silent outside the
 * object even when explicitly told to, so `JSON.parse` on the raw
 * text failed more than once during testing (see runReportGeneration's
 * last-text-block comment — this is the second layer of the same
 * problem, when the stray text lands *inside* the block that also
 * holds the JSON, not in a separate block).
 */
function extractJsonObject(raw: string): string {
  const stripped = stripMarkdownFences(raw);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return stripped;
  return stripped.slice(start, end + 1);
}

function buildUserPrompt(idea: {
  ideaText: string;
  category: string;
  total: number;
  verdict: string;
  scores: ScoreBreakdown;
}): string {
  return `IDEA: ${idea.ideaText}

CATEGORY: ${idea.category}

TOTAL SCORE: ${idea.total}/100

VERDICT (already published): ${idea.verdict}

BREAKDOWN (already computed — argue these marks, do not recompute them):
- Originality: ${idea.scores.originality}/25
- Willingness to pay: ${idea.scores.willingness_to_pay}/25
- Weekend copy risk: ${idea.scores.weekend_copy_risk}/20
- Real problem: ${idea.scores.real_problem}/20
- Delusion index: ${idea.scores.delusion_index}/10

Write the report now. Search before naming any company. Return only the JSON object described in your instructions.`;
}

/**
 * Runs the model to completion, handling pause_turn (a long-running
 * server-tool turn can pause without finishing — see the tool-use
 * docs' caution on this) by pushing the paused assistant turn back and
 * continuing, exactly like the SDK's own streaming-manual-loop
 * pattern. Returns the final text block plus every real search result
 * actually returned along the way.
 */
async function runReportGeneration(
  userPrompt: string
): Promise<{ finalText: string; sources: ReportSource[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  const sources: ReportSource[] = [];
  const seenUrls = new Set<string>();
  let finalMessage: Anthropic.Message | null = null;

  // Generous iteration ceiling for pause_turn resumption — not an
  // expected steady state, just headroom.
  for (let i = 0; i < 6; i++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: REPORT_SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20260318",
          name: "web_search",
          max_uses: MAX_SEARCH_USES,
        },
      ],
      // "high" measured 3-5 minutes per report in testing (see
      // MAX_SEARCH_USES's comment) — "medium" is the documented
      // cost/time step-down "where quality holds" for workloads like
      // this that aren't long-horizon agentic work; the actual output
      // at "high" was already strong, so there's real room to trade a
      // little of that margin for landing near the 30-60s target.
      output_config: { effort: "medium" },
      messages,
    });

    const message = await stream.finalMessage();
    finalMessage = message;

    let lastQuery: string | null = null;
    for (const block of message.content) {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const input = block.input as { query?: unknown } | null | undefined;
        lastQuery = typeof input?.query === "string" ? input.query : null;
      } else if (
        block.type === "web_search_tool_result" &&
        Array.isArray(block.content)
      ) {
        for (const result of block.content) {
          if (!seenUrls.has(result.url)) {
            seenUrls.add(result.url);
            sources.push({
              url: result.url,
              title: result.title,
              query: lastQuery,
            });
          }
        }
      }
    }

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    break;
  }

  if (!finalMessage) {
    throw new Error("Report generation produced no message.");
  }

  // Every text block, concatenated, not just one: with web search in
  // play, Claude may write a short preamble before tool_use ("I'll
  // research this...") AND/OR trailing commentary after the JSON in a
  // later block — which one carries the actual JSON isn't consistent
  // enough to trust a fixed position. extractJsonObject() below finds
  // the embedded object regardless of which block(s) hold stray prose.
  const textBlocks = finalMessage.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (textBlocks.length === 0) {
    throw new Error(
      `Report generation ended with no text block (stop_reason: ${finalMessage.stop_reason}).`
    );
  }

  return { finalText: textBlocks.map((b) => b.text).join("\n"), sources };
}

function contentShapeIsValid(data: unknown): data is DeepDiveReportContent {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  const p1 = d.page1 as Record<string, unknown> | undefined;
  const p2 = d.page2 as Record<string, unknown> | undefined;
  const p3 = d.page3 as Record<string, unknown> | undefined;
  if (!p1 || !p2 || !p3) return false;

  const dims = p1.dimensions;
  const dimsOk =
    Array.isArray(dims) &&
    dims.length === 5 &&
    dims.every(
      (dim, i) =>
        dim &&
        typeof dim === "object" &&
        (dim as Record<string, unknown>).name === DIMENSION_ORDER[i] &&
        typeof (dim as Record<string, unknown>).reasoning === "string"
    );
  if (!dimsOk) return false;
  if (typeof p1.ideaRestated !== "string") return false;
  const weakness = p1.biggestWeakness as Record<string, unknown> | undefined;
  if (
    !weakness ||
    typeof weakness.title !== "string" ||
    typeof weakness.argument !== "string"
  )
    return false;

  if (!Array.isArray(p2.existingPlayers)) return false;
  if (typeof p2.realisticFirstCustomer !== "string") return false;
  if (typeof p2.currentAlternative !== "string") return false;
  const switchRationale = p2.switchRationale as
    | Record<string, unknown>
    | undefined;
  if (
    !switchRationale ||
    typeof switchRationale.wouldSwitch !== "boolean" ||
    typeof switchRationale.argument !== "string"
  )
    return false;

  if (typeof p3.strongestVersion !== "string") return false;
  const tests = p3.testsToRun;
  const testsOk =
    Array.isArray(tests) &&
    tests.length === 3 &&
    tests.every(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof (t as Record<string, unknown>).order === "number" &&
        typeof (t as Record<string, unknown>).test === "string" &&
        typeof (t as Record<string, unknown>).killResult === "string"
    );
  if (!testsOk) return false;
  if (typeof p3.scoreMoverEvidence !== "string") return false;
  if (typeof p3.rewrittenPitch !== "string") return false;

  return true;
}

/** Rough word count across every string field in the generated content —
 *  not exact (JSON punctuation isn't perfectly excluded), close enough
 *  to sanity-check the "~1,500 words" target while reviewing raw output. */
function countWords(content: DeepDiveReportContent): number {
  const strings: string[] = [];
  function walk(v: unknown) {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  }
  walk(content);
  return strings.join(" ").split(/\s+/).filter(Boolean).length;
}

// Structural rule, not a soft target: "after two failed attempts, fail
// loudly rather than returning an unverified report." One retry, two
// attempts total — not three, not unlimited.
const MAX_ATTEMPTS = 2;

/**
 * Generates the deep-dive report for one already-scored submission.
 * Generation-only — no persistence, no PDF, no payment gate. Each
 * attempt is a real, billed Sonnet + web search request; nothing here
 * caches or dedupes repeated calls for the same id (that's a later
 * stage's problem once this is wired behind payment). A failed
 * attempt (malformed JSON, wrong shape, or failed source verification —
 * see sanitizeAndVerify) is retried once with the specific failure
 * reason appended to the prompt; failing verification twice throws
 * rather than returning a report that hasn't actually been checked.
 */
export async function generateReport(
  submissionId: number
): Promise<DeepDiveReport> {
  const idea = await getCardData(submissionId);
  if (!idea) {
    throw new Error(`No submission with id ${submissionId}.`);
  }

  const basePrompt = buildUserPrompt(idea);
  let lastFailureReason = "unknown failure";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nYour previous attempt failed verification: ${lastFailureReason}. Follow the worked citation example exactly — use the actual URL from a search result you already received, and only say no competitor was found if your searches genuinely returned nothing relevant to this idea.`;

    const { finalText, sources } = await runReportGeneration(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(finalText));
    } catch {
      lastFailureReason = "response was not valid JSON";
      console.warn(
        `[generate-report] submission ${submissionId}, attempt ${attempt}: ${lastFailureReason}`
      );
      continue;
    }

    if (!contentShapeIsValid(parsed)) {
      lastFailureReason = "response JSON didn't match the expected shape";
      console.warn(
        `[generate-report] submission ${submissionId}, attempt ${attempt}: ${lastFailureReason}. Raw:`,
        finalText
      );
      continue;
    }

    const verification = sanitizeAndVerify(parsed, sources);
    if (verification.strippedNames.length > 0) {
      console.warn(
        `[generate-report] submission ${submissionId}, attempt ${attempt}: stripped unmappable compan${verification.strippedNames.length === 1 ? "y" : "ies"}: ${verification.strippedNames.join(", ")}`
      );
    }
    if (!verification.ok) {
      lastFailureReason = verification.reason!;
      console.warn(
        `[generate-report] submission ${submissionId}, attempt ${attempt} failed source verification: ${lastFailureReason}`
      );
      continue;
    }

    return {
      ...parsed,
      submissionId,
      ideaText: idea.ideaText,
      category: idea.category,
      scores: idea.scores,
      totalScore: idea.total,
      verdict: idea.verdict,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      sources,
      approxWordCount: countWords(parsed),
    };
  }

  throw new Error(
    `Report generation for submission ${submissionId} failed verification after ${MAX_ATTEMPTS} attempts: ${lastFailureReason}`
  );
}
