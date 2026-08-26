import RateMyIdeaApp from "@/components/RateMyIdeaApp";
import {
  getHighlightBoardRows,
  getLiveStats,
  getMeritBoardRows,
  getTopHighlightAmount,
} from "@/lib/get-board-data";

// Without this, Next.js has no fetch()/cookies()/headers() calls to
// notice here — every read goes straight through pg (lib/db.ts) — so
// it was treating this page as static, prerendering it once at build
// time and serving that same snapshot to everyone forever (confirmed
// live: x-vercel-cache: PRERENDER). The live bar and both boards need
// a real query on every visit.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [meritRows, highlightRows, liveStats, topHighlightAmount] =
    await Promise.all([
      getMeritBoardRows(),
      getHighlightBoardRows(),
      getLiveStats(),
      getTopHighlightAmount(),
    ]);

  return (
    <RateMyIdeaApp
      meritRows={meritRows}
      highlightRows={highlightRows}
      liveStats={liveStats}
      topHighlightAmount={topHighlightAmount}
    />
  );
}
