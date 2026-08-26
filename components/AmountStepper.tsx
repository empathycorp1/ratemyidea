"use client";

import { useState } from "react";
import { MAX_BID, MIN_BID, stepSize } from "@/lib/board-ui";

interface Props {
  /** Highest amount currently on the Highlight Board — 0 while nothing
   *  has been highlighted yet (no payment flow exists). Real data,
   *  replacing the prototype's hard-coded TOP_BID = 480. */
  topAmount: number;
  amount: number;
  onAmountChange: (v: number) => void;
}

function clamp(v: number): number {
  if (isNaN(v) || v < MIN_BID) return MIN_BID;
  if (v > MAX_BID) return MAX_BID;
  return v;
}

// Ported from homepage-prototype.html's bump()/typed()/settle()/paint() —
// same stepping logic, same clamping, same "$X takes the top spot" copy.
export default function AmountStepper({
  topAmount,
  amount,
  onAmountChange,
}: Props) {
  // While actively typing, the raw (possibly not-yet-valid) digits are
  // shown as-is — matching typed(), which doesn't clamp until blur.
  const [rawInput, setRawInput] = useState<string | null>(null);

  const displayValue = rawInput ?? amount.toLocaleString();
  const widthCh = Math.max(2, displayValue.length + 0.5);

  function bump(dir: 1 | -1) {
    const next =
      dir > 0 ? amount + stepSize(amount) : amount - stepSize(amount - 1);
    const clamped = clamp(next);
    setRawInput(null);
    onAmountChange(clamped);
  }

  function handleTyped(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "");
    setRawInput(digits);
    onAmountChange(parseInt(digits || "0", 10));
  }

  const topline =
    amount > topAmount
      ? "That takes the top spot."
      : `$${(topAmount + 1).toLocaleString()} takes the top spot.`;

  return (
    <>
      <div className="lead">
        <span>Highlight your Idea for</span>
        <button
          className="step"
          onClick={() => bump(-1)}
          disabled={amount <= MIN_BID}
          aria-label="Lower"
        >
          &minus;
        </button>
        <span className="field">
          <span className="cur">$</span>
          <input
            value={displayValue}
            onChange={(e) => handleTyped(e.target.value)}
            onBlur={() => {
              const clamped = clamp(parseInt(rawInput ?? String(amount), 10));
              setRawInput(null);
              onAmountChange(clamped);
            }}
            inputMode="numeric"
            aria-label="Amount"
            style={{ width: `${widthCh}ch` }}
          />
        </span>
        <button className="step" onClick={() => bump(1)} aria-label="Raise">
          +
        </button>
      </div>
      <p className="note">
        Any amount puts you on the board. <b>{topline}</b>
      </p>
    </>
  );
}
