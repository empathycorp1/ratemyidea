import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { RateLimitError } from "@/lib/rate-limit";
import { scoreIdea } from "@/lib/score-idea";
import { SCORING_PAUSED, SCORING_PAUSED_MESSAGE } from "@/lib/scoring-status";

const INVALID_MESSAGE =
  "That does not look like a business idea. Try describing a product or service and who it is for.";

// Deliberately neutral — per scoring-spec.md, never explain which rule
// was triggered, since that's a map for working around it.
const FLAGGED_MESSAGE = "This submission can't be scored.";

export async function POST(req: NextRequest) {
  // Checked first, before touching the body or the DB — the homepage
  // never sends this request while SCORING_PAUSED is on (see
  // components/SubmitForm.tsx), but /test and anyone hitting this
  // route directly still can. A clear, deliberate response beats a
  // 500 from a real Anthropic call that's guaranteed to fail right
  // now. See lib/scoring-status.ts to flip this back.
  if (SCORING_PAUSED) {
    return NextResponse.json(
      { error: SCORING_PAUSED_MESSAGE, paused: true },
      { status: 503 }
    );
  }

  let body: { idea?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON, e.g. { \"idea\": \"...\" }." },
      { status: 400 }
    );
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (!idea) {
    return NextResponse.json(
      { error: "Missing 'idea' in request body." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);

  try {
    const result = await scoreIdea(idea, ip);

    // Flagged and invalid submissions are normal outcomes, not errors —
    // scoreIdea() never stores either of them (see lib/score-idea.ts).
    if (result.flagged) {
      return NextResponse.json({
        valid: result.valid,
        flagged: true,
        message: FLAGGED_MESSAGE,
      });
    }

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        flagged: false,
        message: INVALID_MESSAGE,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }

    console.error("[api/score] scoring failed:", err);
    // Per scoring-spec.md's failure handling: never invent a score,
    // never store anything on failure.
    return NextResponse.json(
      { error: "Scoring failed. Nothing was stored. Try again in a moment." },
      { status: 502 }
    );
  }
}
