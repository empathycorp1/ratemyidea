import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/generate-report";

// Dev-only, deliberately — this is a real, billed Sonnet + web search
// call (30-60s, real money) with no payment gate in front of it yet.
// NODE_ENV is "production" on every real Vercel deployment (including
// preview deployments, not just the live domain), so this genuinely
// never responds outside a local `next dev` — matches the request's
// "Restrict it to development" instruction literally, not just in
// intent.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Props) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found.", { status: 404 });
  }

  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const report = await generateReport(submissionId);
    return NextResponse.json(report);
  } catch (err) {
    console.error(`[api/report/preview] failed for submission ${submissionId}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
