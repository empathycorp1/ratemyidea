"use client";

import { CATEGORY_LABELS, CATEGORY_TAB_ORDER } from "@/lib/categories";

const VISIBLE = 7; // exact from homepage-prototype.html's VISIBLE

export const ALL_CATS: Array<{ value: string; label: string }> = [
  { value: "All", label: "All" },
  ...CATEGORY_TAB_ORDER.map((v) => ({ value: v, label: CATEGORY_LABELS[v] })),
];

interface Props {
  id: string;
  active: string;
  onChange: (value: string) => void;
  /** Only one "More" popup is open at a time, across both tab groups —
   *  lifted to the parent so it can be a single shared value, matching
   *  homepage-prototype.html's popup() closing every .pop before
   *  opening the target one. */
  openPopupId: string | null;
  onOpenPopupChange: (id: string | null) => void;
}

// Required DOM structure, exactly three levels: .tabs > .tabScroll (the
// scrollable, non-wrapping row of visible pills) + .moreWrap (a fixed-
// size sibling, never inside .tabScroll) > .tab "More" button + .pop.
export default function CategoryTabs({
  id,
  active,
  onChange,
  openPopupId,
  onOpenPopupChange,
}: Props) {
  const isOpen = openPopupId === id;

  const vis = ALL_CATS.slice(0, VISIBLE);
  let rest = ALL_CATS.slice(VISIBLE);
  const activeInRest = rest.find((c) => c.value === active);
  if (activeInRest) {
    rest = rest.filter((c) => c.value !== active);
    vis.push(activeInRest);
  }

  function pick(value: string) {
    onOpenPopupChange(null);
    onChange(value);
  }

  return (
    <div className="tabs">
      <div className="tabScroll">
        {vis.map((c) => (
          <button
            key={c.value}
            className={`tab${c.value === active ? " on" : ""}`}
            onClick={() => pick(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="moreWrap">
          <button
            className="tab"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPopupChange(isOpen ? null : id);
            }}
          >
            More &#9662;
          </button>
          {isOpen && (
            <div className="pop open">
              {rest.map((c) => (
                <button key={c.value} onClick={() => pick(c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
