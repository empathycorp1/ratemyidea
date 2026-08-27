import { notFound } from "next/navigation";
import { getCardData } from "@/lib/get-card-data";
import { getTopHighlightAmount } from "@/lib/get-board-data";
import { getActiveHighlightAmountCents } from "@/lib/highlights";
import { MAX_BID, MIN_BID } from "@/lib/board-ui";
import HighlightCheckout from "@/components/HighlightCheckout";

// Reads the DB via raw pg (getCardData, getTopHighlightAmount) — same
// PRERENDER trap documented in PROGRESS.md for every other DB-reading
// page. Without this, the top-spot amount shown here would freeze at
// whatever it was on the last deploy.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amount?: string }>;
};

export default async function HighlightPage({ params, searchParams }: Props) {
  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) notFound();

  const idea = await getCardData(submissionId);
  if (!idea) notFound();

  const topAmount = await getTopHighlightAmount();
  const existingAmountCents = await getActiveHighlightAmountCents(submissionId);
  const existingAmount =
    existingAmountCents !== null ? Math.round(existingAmountCents / 100) : null;

  const { amount: rawAmount } = await searchParams;
  const parsed = Number(rawAmount);
  const initialAmount =
    Number.isFinite(parsed) && parsed >= MIN_BID && parsed <= MAX_BID
      ? Math.round(parsed)
      : MIN_BID;

  return (
    <HighlightCheckout
      submissionId={submissionId}
      ideaText={idea.ideaText}
      category={idea.category}
      total={idea.total}
      topAmount={topAmount}
      initialAmount={initialAmount}
      existingAmount={existingAmount}
    />
  );
}
