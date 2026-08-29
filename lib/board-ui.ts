// Pure logic ported from homepage-prototype.html's stepSize/ranges/slice
// functions, exactly as written — only the output shape changed (React
// data instead of built HTML strings), not the logic itself.

// $5 minimum, matching the terms page (the prototype itself had $4 —
// corrected here to match the actual stated terms, not a value taken
// from the prototype file). Single source of truth for the stepper,
// the initial claim-strip amount, and every /highlight screen's
// defensive clamping.
export const MIN_BID = 5;
// Dodo's product itself has no configured maximum (their dashboard
// doesn't offer one) — this $999,999 ceiling is enforced entirely on
// our side: here (the stepper/clamp), in app/highlight/[id]/page.tsx,
// and again in app/api/highlight/checkout/route.ts right before a
// checkout session is created, so no path to Dodo can ever be reached
// with an amount above it.
export const MAX_BID = 999999;

export function stepSize(v: number): number {
  if (v < 10) return 1;
  if (v < 50) return 5;
  if (v < 200) return 10;
  if (v < 1000) return 50;
  if (v < 10000) return 500;
  return 5000;
}

export interface RangeOption {
  label: string;
  value: number;
}

/** `value` mirrors the prototype's convention: positive N means "top
 *  N", negative -S means "starting at offset S-1" (see slice() below).
 *
 *  Bug fixed here: the round "Top N" steps (3/10/20/50) only ever
 *  landed on exact tier boundaries. With, say, 16 entries, `total >=
 *  20` and `total >= 50` are both false, so no tier past "Top 10" ever
 *  appeared and rows 11–16 were unreachable — nothing offered "show
 *  everything". Same gap exists at every step, not just 10–20 (e.g. 35
 *  entries stalls at "Top 20"). Fixed by adding a final tier whenever
 *  the total sits strictly past the largest round tier actually shown
 *  and isn't already covered by one — labeled with the real count
 *  ("All 16"), not another round number, since there isn't one that
 *  fits. */
export function ranges(total: number, current: number): RangeOption[] {
  const out: RangeOption[] = [];
  const steps = [3, 10, 20, 50];
  let largestStepShown = 0;
  steps.forEach((s) => {
    if (total >= s) {
      out.push({ label: `Top ${s}`, value: s });
      largestStepShown = s;
    }
  });
  if (total > 50) {
    for (let s = 51; s <= total; s += 50) {
      out.push({
        label: `${s}–${Math.min(s + 49, total)}`,
        value: -s,
      });
    }
  } else if (largestStepShown > 0 && total > largestStepShown) {
    out.push({ label: `All ${total}`, value: total });
  }
  return out;
}

export function slice<T>(rows: T[], range: number): [T[], number] {
  if (range > 0) return [rows.slice(0, range), 0];
  const off = -range - 1;
  return [rows.slice(off, off + 50), off];
}
