import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { RateLimitError } from "@/lib/rate-limit";
import { scoreIdea } from "@/lib/score-idea";

const INVALID_MESSAGE =
  "That does not look like a business idea. Try describing a product or service and who it is for.";

// Deliberately neutral — per scoring-spec.md, never explain which rule
// was triggered, since that's a map for working around it.
const FLAGGED_MESSAGE = "This submission can't be scored.";

export async function POST(req: NextRequest) {
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
