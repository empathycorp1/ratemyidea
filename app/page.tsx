import RateMyIdeaApp from "@/components/RateMyIdeaApp";
import {
  getHighlightBoardRows,
  getLiveStats,
  getMeritBoardRows,
  getTopHighlightAmount,
} from "@/lib/get-board-data";

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
