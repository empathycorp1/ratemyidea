import type { Metadata } from "next";
import { getMeritBoardRows } from "@/lib/get-board-data";
import FullBoardView from "@/components/FullBoardView";

export const metadata: Metadata = {
  title: "The Merit Board · RateMyIdea",
  description:
    "Every idea ever scored on RateMyIdea, ranked by score alone. Money cannot move it up here.",
};

// Reads the DB via raw pg (getMeritBoardRows) — same PRERENDER trap
// documented in PROGRESS.md for every other DB-reading page. Without
// this, the board would freeze at whatever it was on the last deploy
// instead of reflecting every new submission.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  // No deviceId here (it's a client-only localStorage value) — same
  // as app/page.tsx: likedByMe starts false for everyone on a fresh
  // load, and only reflects this session's own clicks after that.
  const meritRows = await getMeritBoardRows();

  return <FullBoardView initialRows={meritRows} />;
}
