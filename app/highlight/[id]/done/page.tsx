import { notFound } from "next/navigation";
import { getHighlightById } from "@/lib/highlights";
import HighlightDone from "@/components/HighlightDone";

// Reads the DB via raw pg (getHighlightById) — force-dynamic for the
// same reason as every other DB-reading page (see PROGRESS.md).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlightId?: string }>;
};

export default async function HighlightDonePage({ params, searchParams }: Props) {
  const { id } = await params;
  const submissionIdFromUrl = Number(id);
  const { highlightId: rawHighlightId } = await searchParams;
  const highlightId = Number(rawHighlightId);

  if (!Number.isInteger(submissionIdFromUrl) || submissionIdFromUrl <= 0) notFound();
  if (!Number.isInteger(highlightId) || highlightId <= 0) notFound();

  const highlight = await getHighlightById(highlightId);
  if (!highlight) notFound();

  // The URL's [id] segment just mirrors what the checkout route put in
  // return_url — the highlight row's own submission_id is what's
  // actually trusted for the "view your idea" link, in case the two
  // ever disagree.
  return (
    <HighlightDone submissionId={highlight.submissionId} highlightId={highlightId} />
  );
}
