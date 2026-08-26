// Placeholder only, per instructions — the highlight payment flow
// itself isn't built yet. This just needs to exist so the claim
// strip's "Highlight" button has somewhere to go.

import { MIN_BID } from "@/lib/board-ui";

type Props = { searchParams: Promise<{ amount?: string }> };

export default async function HighlightAmountPlaceholder({
  searchParams,
}: Props) {
  const { amount: raw } = await searchParams;
  const parsed = Number(raw);
  // Defensive floor even here — a placeholder shouldn't ever display
  // (or later, once built, accept) an amount below the stated minimum,
  // including via a hand-edited URL.
  const amount =
    Number.isFinite(parsed) && parsed > MIN_BID ? Math.round(parsed) : MIN_BID;

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <p>Highlight flow for ${amount} — coming soon.</p>
    </div>
  );
}
