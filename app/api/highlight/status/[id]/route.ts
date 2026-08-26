import { getHighlightById, reconcileHighlight } from "@/lib/highlights";

// GET, reads the DB via raw pg — statically cacheable by Next's classic
// heuristic without this (see PROGRESS.md). A cached "pending" response
// here would mean the confirmation page never learns it went through.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const highlightId = Number(id);
  if (!Number.isInteger(highlightId) || highlightId <= 0) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  let row = await getHighlightById(highlightId);
  if (!row) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  // Every poll of a still-pending placement doubles as a reconciliation
  // attempt against Dodo directly — recovers a placement whose webhook
  // got dropped, without needing a separate scheduled job. See
  // lib/highlights.ts's reconcileHighlight for what this actually does.
  if (row.status === "pending") {
    row = (await reconcileHighlight(highlightId)) ?? row;
  }

  return Response.json({
    status: row.status,
    flagged: row.flagged,
    submissionId: row.submissionId,
  });
}
