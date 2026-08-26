"use client";

import { ranges } from "@/lib/board-ui";

interface Props {
  total: number;
  current: number;
  onChange: (value: number) => void;
}

// Ported from homepage-prototype.html's ranges() rendering.
export default function RangeSelector({ total, current, onChange }: Props) {
  const opts = ranges(total, current);
  if (opts.length === 0) return null;

  return (
    <div className="ranges">
      {opts.map((r, i) => (
        <span key={r.value} style={{ display: "contents" }}>
          {i > 0 && <i>|</i>}
          <button
            className={r.value === current ? "on" : undefined}
            onClick={() => onChange(r.value)}
          >
            {r.label}
          </button>
        </span>
      ))}
    </div>
  );
}
