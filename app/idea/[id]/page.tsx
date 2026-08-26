import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCardData } from "@/lib/get-card-data";
import {
  getHighlightBoardRows,
  getLiveStats,
  getMeritBoardRows,
  getTopHighlightAmount,
} from "@/lib/get-board-data";
import { incrementVisit } from "@/lib/increment-visit";
import RateMyIdeaApp from "@/components/RateMyIdeaApp";

// Without this, a dynamic route segment with no generateStaticParams
// still risks its first render per id being cached and reused for
// every later visitor — meaning a shared card could show whatever
// rank was current the first time anyone opened it, forever, and
// incrementVisit() below would stop actually incrementing anything
// after that first render too. Both must run fresh on every visit.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Memoized so generateMetadata and the page body share one DB hit.
const getIdea = cache(async (id: number) => getCardData(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) return {};

  const idea = await getIdea(idNum);
  if (!idea) return {};

  const title = `${idea.total}/100 — ${idea.ideaText}`;
  const description = idea.verdict;
  const imageUrl = `/api/card/${idNum}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function IdeaPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) notFound();

  const idea = await getIdea(idNum);
  if (!idea) notFound();

  // A real, separate server-rendered visit — a shared link or a
  // refresh, not the submitter's own pushState transition (that never
  // hits this route). See lib/increment-visit.ts.
  await incrementVisit(idNum);

  const [meritRows, highlightRows, liveStats, topHighlightAmount] =
    await Promise.all([
      getMeritBoardRows(),
      getHighlightBoardRows(),
      getLiveStats(),
      getTopHighlightAmount(),
    ]);

  // Someone landing here directly (a shared link, a refresh) sees the
  // finished result immediately, with no count-up — that animation is
  // only for the person who just submitted, on the homepage. See
  // components/RateMyIdeaApp.tsx and ResultView's `animate` prop.
  return (
    <RateMyIdeaApp
      initialResult={{
        id: idNum,
        ideaText: idea.ideaText,
        verdict: idea.verdict,
        total: idea.total,
        category: idea.category,
        scores: idea.scores,
        rank: idea.rank,
        totalSubmissions: idea.totalSubmissions,
      }}
      meritRows={meritRows}
      highlightRows={highlightRows}
      liveStats={liveStats}
      topHighlightAmount={topHighlightAmount}
    />
  );
}
