import type { NextRequest } from "next/server";

/**
 * Best-effort caller IP for rate limiting. On Vercel, requests arrive
 * through a proxy that sets `x-forwarded-for` (a comma-separated list —
 * the first entry is the original client). There is no other reliable
 * source of the real IP in that environment: Next's own `request.ip` is
 * not populated on Vercel's Node/Edge runtimes, so this header is the
 * one that actually matters in production.
 *
 * Locally (no proxy in front of `next dev`), this header is absent, so
 * every local request falls into the same "unknown" bucket — that's
 * fine for local testing, but it means the per-IP limits effectively
 * become one shared limit across everyone testing on localhost at once.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
