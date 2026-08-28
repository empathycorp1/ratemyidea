// Carries the amount someone picked on the homepage claim strip
// through to a real /highlight/[id] page after they've scored an idea
// — there's no idea id yet when they pick the amount (that's the whole
// problem this exists to solve), so it can't travel as a `?amount=`
// query param on a URL that doesn't exist yet. localStorage bridges
// that gap; consumePendingHighlightAmount() clears it after one read
// so a months-old choice never silently resurfaces on an unrelated
// later purchase.

const KEY = "rmi_pending_highlight_amount";

export function rememberHighlightAmount(amount: number): void {
  try {
    window.localStorage.setItem(KEY, String(amount));
  } catch {
    // localStorage unavailable — the amount just won't carry over,
    // which isn't worth failing anything over.
  }
}

export function consumePendingHighlightAmount(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    window.localStorage.removeItem(KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
