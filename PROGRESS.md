# RateMyIdea — Progress Notes

Written for a fresh Claude session with no memory of how this was built.
Read this before touching anything. Also read `AGENTS.md` (this Next.js
version has real breaking changes from what you'd expect — check
`node_modules/next/dist/docs/` before writing App Router code),
`scoring-spec.md`, and `ratemyidea-build-manual.md` — those are the
original product specs and are still accurate references.

## What this is

A site where anyone submits a one-line business idea, an LLM scores it
0–100 with a rubric and a savage one-line verdict, and it lands on a
public leaderboard (the Merit Board, ranked by score). Full original
concept in `ratemyidea-build-manual.md` — that concept included a paid
Highlight Board (ranked by spend); **that's being replaced, as of
2026-08-29, by a paid PDF deep-dive report on a scored idea (₹995 /
$9.99)**. Nothing about the Highlight Board has been removed yet — the
new product is being built first, deliberately, before any dismantling
starts (explicit instruction). See "Deep-dive report" below for what
exists of the new product so far (generation engine only) and the
existing Highlight Board sections below for what's still fully live.

## Current state

**Scoring is paused site-wide right now (2026-08-29) — `lib/scoring-status.ts`'s
`SCORING_PAUSED = true`.** The Anthropic account ran out of API credit
mid-testing the deep-dive report generator (see "Deep-dive report"
below) — real visitors were hitting a 500 trying to score an idea, so
submission was switched off rather than left broken. This is a single
boolean, checked in exactly two places (`components/SubmitForm.tsx`,
`app/api/score/route.ts`) — full detail in "Idea submission paused"
below. **Flip `SCORING_PAUSED` back to `false` once
console.anthropic.com shows credit again — nothing else needs to
change.** Everything else (both boards, idea pages, share cards,
stats, legal pages, likes, presence, the visitor counter) is
unaffected and was verified working while this is on.

**Live at:** https://ratemyidea-flax.vercel.app
**Vercel project:** vercel.com/rate-my-idea/ratemyidea
**Repo:** github.com/empathycorp1/ratemyidea (private) — pushing to
`main` auto-deploys. No CLI needed or working (see Deployment below).

Built and working end-to-end: idea submission → scoring → result page
→ share card → homepage with both boards, live stats, likes, a working
dark theme, and a real Highlight Board payment flow via Dodo Payments.
**Switched from Dodo's test mode to live mode on 2026-08-27** — all
four `DODO_*` env vars on Vercel now hold live credentials, and the
test-mode-only startup guard that used to live in `lib/dodo.ts` was
deliberately removed (see that file's own comment). This site now
takes real payments. Verified against real production traffic and,
while it was still test-mode, Dodo's test-mode API — the live-mode
integration itself hasn't had the same battery of synthetic
webhook/refund/mismatch tests run against it (those all required a
test-mode product), so treat the payment flow as "known-good in test
mode, structurally unchanged in live mode" rather than independently
re-verified live.

**Database was wiped for launch just before this note was written.**
All tables were emptied and every serial id sequence reset to 1, then
re-verified by submitting one real test idea end-to-end (homepage
counter, both boards' empty states, rank calculation). That means
**there is currently exactly one row in `submissions` (id 1, a
coffee-roasters marketplace idea, score 42)** — the verification
artifact, not a real user. The user was offered a final wipe to remove
even that row and the conversation ended before they answered. Ask
before assuming the DB should be touched again.

## Architecture map

```
lib/
  scoring-prompt.ts     — the system prompt (versioned, see below)
  score-idea.ts          — normalize → hash → cache check → call model →
                            validate/retry → recompute total → coerce
                            category → store. Main entry: scoreIdea(text, ip)
  categories.ts           — the 16-value category enum (source of truth)
  normalize.ts            — lowercase/strip-punct/collapse-whitespace + SHA-256
  rate-limit.ts           — 5/min, 30/day per IP, 2000/day global (DAILY_SCORE_CAP)
  client-ip.ts             — reads x-forwarded-for
  db.ts                    — pg connection (DNS workaround — see Gotchas)
  get-board-data.ts        — Merit/Highlight board rows + live stats queries
  get-card-data.ts         — one idea + live rank, used by card image AND idea page
  board-ui.ts               — pure UI logic: stepSize/ranges/slice, MIN_BID/MAX_BID
  likes.ts, presence.ts, device-id.ts, increment-visit.ts, types.ts
  visitors.ts               — recordVisit/getVisitorStats, backing the
                              /stats visitor counter — see below, this
                              is deliberately NOT the same table/concern
                              as presence.ts
  scoring-status.ts          — SCORING_PAUSED (currently true) +
                              SCORING_PAUSED_MESSAGE, the site-wide
                              kill switch for idea submission. See
                              "Idea submission paused" below.
  report-prompt.ts           — REPORT_SYSTEM_PROMPT for the new deep-dive
                              report — imports SCORING_SYSTEM_PROMPT
                              directly (not copy-pasted) so the report's
                              per-dimension reasoning can never silently
                              drift from the rubric that actually
                              produced the score. See "Deep-dive report"
                              below.
  generate-report.ts         — generateReport(submissionId): the whole
                              generation engine — Sonnet + web search,
                              JSON-only output, malformed-JSON retry.
                              Generation only, no persistence yet.

components/
  RateMyIdeaApp.tsx        — top-level client component: whole page shell,
                              theme toggle, form/result toggle, both boards
  SubmitForm.tsx, ResultView.tsx, CategoryTabs.tsx, RangeSelector.tsx,
  AmountStepper.tsx
  SiteHeader.tsx, SiteFooter.tsx, LegalLayout.tsx — shared shell for
                              every non-homepage page (/terms, /refunds,
                              /contact, /how-scoring-works, /stats,
                              /board) — see "CSS namespacing" below
  FullBoardView.tsx         — the full Merit Board (app/board/page.tsx),
                              reusing CategoryTabs/RangeSelector and the
                              exact same like-toggle logic as
                              RateMyIdeaApp's Merit Board widget — not a
                              separate design, the same board unsliced
  VisitTracker.tsx           — mounted once in app/layout.tsx, renders
                              nothing, fires one POST /api/visit per
                              real page load. See "Visitor counter"
                              below.

**The header logo (mark + wordmark) is a real link home, everywhere
(fixed 2026-08-29).** It used to be an inert `<div className="brandwrap">`
— on every page except the homepage there was no way back to it at
all. `.brandwrap` is now a plain `<a href="/">` (not `next/link`) in
all **four** places this header markup exists:
`components/SiteHeader.tsx`, `components/RateMyIdeaApp.tsx`,
`components/HighlightCheckout.tsx`, and `components/HighlightDone.tsx`
— the last two were a separate, previously-undocumented duplication of
the exact same bug, found by grepping for `brandwrap` rather than
trusting the "two places" the request named. Plain `<a>`, deliberately,
not `next/link`: on the homepage, a scored result gets its URL via a
manual `window.history.pushState` to `/idea/N` (see
`RateMyIdeaApp.tsx`'s `handleScored`), not a real Next.js route change
— Next's router doesn't necessarily know it's left `/`, so a soft
`<Link>` click there could no-op instead of actually resetting the
page. A real navigation sidesteps that ambiguity everywhere, at the
cost of a full reload instead of a soft transition (matches "reloads
home" in the request). Verified this exact edge case directly: pushed
a fake `/idea/999` URL via `history.pushState` on the homepage, then
confirmed clicking the logo still lands on a fresh `/`.
Appearance is unchanged (`.brandwrap` already set its own colors on
`.brand`/`.brand b`; the fix just adds `text-decoration: none` and a
`:hover{opacity:.87}`, matching the hover convention used on
`.submit`/`.hlchk-submit` elsewhere) — confirmed via computed styles,
not just visual inspection.
`components/SiteFooter.tsx` has no "Home" link of its own; the header
fix is what closes this gap on every page that renders it.

app/
  page.tsx                 — homepage (force-dynamic)
  idea/[id]/page.tsx        — result page + OG metadata (force-dynamic)
  api/card/[id]/route.tsx   — share card PNG via next/og (force-dynamic)
  api/score/route.ts        — POST, scores an idea
  api/like/route.ts, api/presence/route.ts, api/visit/route.ts — POST,
                              all three fire-and-forget
  api/report/preview/[id]/route.ts — GET, dev-only (404s whenever
                              NODE_ENV !== "development", so this never
                              responds on any real Vercel deployment).
                              Raw-JSON output of generateReport() for
                              manual inspection — see "Deep-dive report"
                              below. No auth beyond the dev gate; same
                              real-money-per-call shape as /test, just
                              additionally environment-locked.
  highlight/page.tsx        — the old query-param placeholder. ORPHANED
                              now — nothing links to it since the claim
                              strip button was rewired (see "Claim strip
                              Highlight button"). Left in place, not
                              deleted; that's a separate ask. Genuinely
                              a dead end if anyone still lands here (old
                              bookmark, a search engine that indexed it
                              early) — no header, no footer, no link
                              anywhere on the page. Flagged during the
                              2026-08-29 header-link dead-end audit;
                              not fixed, since fixing a page that's
                              already scheduled for removal felt like
                              wasted effort — worth remembering if it's
                              ever NOT deleted after all.
  highlight/[id]/page.tsx   — REAL: Dodo checkout form for one idea
                              (force-dynamic)
  highlight/[id]/done/page.tsx — REAL: post-checkout confirmation/poll
                              page (force-dynamic)
  api/highlight/checkout/route.ts — POST: writes a pending `highlights`
                              row, creates the Dodo checkout session
  api/highlight/status/[id]/route.ts — GET: polled by the done page;
                              reconciles against Dodo on every pending
                              poll (force-dynamic)
  api/dodo/webhook/route.ts — POST: source of truth for placement —
                              see "Highlight Board payment flow" below
  board/page.tsx             — REAL: the full Merit Board (every entry,
                              category filter, range selector) —
                              force-dynamic, see "Full Merit Board page"
                              below. Highlight Board has no equivalent
                              full-list page — never requested.
  test/page.tsx              — raw-JSON scoring test page — see Known Issues
  home.css, result.css, highlight.css — see "CSS namespacing" below
  layout.tsx                 — root layout + blocking dark-mode bootstrap script

lib/
  dodo.ts                  — DodoPayments SDK client singleton; throws
                              at import time if DODO_ENVIRONMENT isn't
                              "test_mode" or "live_mode" (see below —
                              this is live_mode now, deliberately)
  highlights.ts             — all `highlights` table access: pending
                              row creation, activateHighlight (webhook's
                              path), deactivateHighlightByPaymentId
                              (refund path), reconcileHighlight (dropped-
                              webhook recovery)
  highlight-url.ts          — validates the optional website URL against
                              terms.html §07 (https-only, no shorteners,
                              no affiliate params, no invite links, best-
                              effort no-redirect-chain check)
  highlight-amount-memory.ts — localStorage bridge for the claim strip's
                              Highlight button when there's no idea yet
                              (rememberHighlightAmount /
                              consumePendingHighlightAmount) — see
                              "Claim strip Highlight button" below

db/schema.sql               — idempotent, safe to rerun via `npm run db:migrate`
scripts/migrate.mjs         — runs schema.sql against DATABASE_URL
scripts/calibrate.mjs       — reusable: scores the 8 calibration ideas by
                              default, `--fifty` also runs 50 distribution-test ideas
scripts/rerun-top15.mjs, scripts/test-rate-limit.mjs — one-off leftovers, safe to ignore/delete

assets/fonts/Carlito-*.ttf   — real font files, downloaded from
                               github.com/googlefonts/carlito, used by the
                               share card generator (next/og needs real font
                               files, can't use Google Fonts CSS there)

homepage-prototype.html, result-page-prototype.html, share-card-preview.html
                             — the approved design source files. Fully
                               implemented already. Keep for reference if
                               redesigning; don't need to re-read otherwise.
```

## Key decisions and why

**`pg` over `@neondatabase/serverless`.** Started with the serverless
driver (recommended for Neon+Vercel), but the local dev machine's ISP
DNS resolver flatly refused to resolve the long Neon hostname
("Query refused" — confirmed it resolves fine via 8.8.8.8, so a Neon
problem it is not). Switched to plain `pg` with a workaround baked into
`lib/db.ts`: resolve the hostname explicitly via a public DNS server,
connect by IP, and pass the original hostname as `servername` so TLS
still validates the real certificate. This runs on every connection,
including production, but is harmless where DNS already works fine —
it was left in rather than special-cased, to keep local and prod
identical.

**Category list built from the scorer, not the homepage prototype.**
`homepage-prototype.html`'s own `CATS` array has `"Food"` (the scorer
never assigns it) and is missing `developer-tools`/`social`/
`productivity` (real categories it does assign). Category tabs are
built from `lib/categories.ts`'s real 16-value enum instead — using the
prototype's list verbatim would have meant permanently-empty tabs and
categories with no way to filter to them.

**Rank is always computed live, never stored.** A score is immutable
once cached, but standing on the leaderboard isn't — it shifts as new
ideas get scored. `getRankInfo()`/`getCardData()` compute it fresh on
every read (cache hit or not). This is also why `force-dynamic` matters
so much (see below) — a cached page would freeze a rank at whatever it
was on first render, and a shared card is specifically the place a
stale rank would be most visible and most embarrassing.

**Prompt versioning.** `lib/scoring-prompt.ts` exports
`SCORING_PROMPT_VERSION` (currently `"v3"`), stored on every
`submissions` row. History is in that file's own header comment: v2
added a business-type classification step and high-end calibration
anchors; v3 fixed low-end score compression (a lawn-care Uber clone was
scoring 44 against an 18–28 target even though the model's *reasoning*
about the market was correct — the dimensions were answering "is this
market real" instead of "does THIS submission earn a switch"); v4 tried
forcing verdicts above a score threshold to name a strength instead of
a weakness, hypothesizing that would also raise the score ceiling — it
didn't (6 of 15 re-tested scores went down, 2 up by one point each),
so it was reverted same-day. **Calibration is currently 5/8 against the
8-question set in `scoring-spec.md`**, and all 4 distribution-test
checks pass (median, stdev, tail counts on a 50-idea sample). The
3 failing calibration questions were judged to be the target ranges
being estimates rather than the scorer being wrong — see conversation
history if revisiting this, but don't re-tune casually: changing the
prompt makes old and new scores incomparable on the same leaderboard,
which is the entire reason `prompt_version` exists.

**Category enum is enforced server-side, not just prompted.** The
model occasionally returns a category outside its own 16-value
instruction list (seen twice: `"software"`, which isn't in the list at
all). `score-idea.ts` coerces anything unrecognized to `"other"` and
logs a warning rather than failing the request.

**Result view CSS is namespaced (`result-` prefix, root `.result-view`).**
Originally used bare class names (`.row`, `.note`, etc.) matching the
approved design file literally. Once the homepage's board UI
(`home.css`) started sharing the same page and cascade, two real
collisions appeared: `.row` (breakdown rows vs. Merit Board rows — the
board's `display:grid` was leaking into the breakdown, splitting labels
across lines) and `.note` (the claim strip's caption vs. the low-score
panel). Found via a full audit of every class name in both stylesheets,
not just the one the user reported. Fixed by prefixing every result-view
class; `.hero` itself stays unprefixed since `home.css` genuinely owns
it and `result.css` only ever reaches into it via a scoped descendant
selector. **If you add new result-view styling, keep using the
`result-` prefix — don't reintroduce bare class names.**

**Result view has its own frozen light-only-by-default color tokens,
scoped to `.result-view`, but dark mode IS implemented.** `--indigo`/
`--periwinkle`/`--line` aren't redeclared there at all (they inherit
from `home.css`'s theme-aware `:root`/`[data-theme="dark"]`, which is
what makes the score number lighten in dark mode exactly like the
boards do). `--black`/`--grey`/`--grey-soft` are local aliases onto
`home.css`'s `--text`/`--muted`/`--faint`. A few hardcoded colors with
no natural dark equivalent (the low-score note panel's gradient, the
nudge panel) get an explicit `[data-theme="dark"]` override reusing
existing tokens (`--panel`, `--bg`) rather than inventing new hex
values. The solid "Share your card" button uses `--btn-bg`/`--btn-fg`
(a flip pair), not the plain text token, because a button *fill* needs
to invert with the theme, not just follow it.

**Category tabs required a markup rewrite, not a CSS fix.** Two
CSS-only attempts at stopping the pills wrap to a second line failed.
Root cause: `.moreWrap` was nested inside the same wrapping flex row as
the pills, and — separately — a flex child without `min-width:0`
refuses to shrink below its own content width, which forces a wrap
regardless of what else is tried. Fixed by restructuring to exactly
three levels: `.tabs > .tabScroll` (the scrollable, non-wrapping pill
row — `flex:1 1 auto; min-width:0; overflow-x:auto`) `+ .moreWrap`
(a fixed-size sibling, `flex:0 0 auto`, never inside `.tabScroll`).
Verified with `getBoundingClientRect()` measurements, not just visual
inspection, at both 375px and desktop, on both boards.

**Board data is fetched in full and filtered client-side**, mirroring
how the prototype's own in-memory `BOARD`/`HL_SEED` arrays worked.
Reasonable at today's scale (~150 rows). **Will need real server-side
pagination before it doesn't** — there's no pagination architecture at
all right now, just "fetch everything, slice in the browser."

**`force-dynamic` on every DB-reading page** (`app/page.tsx`,
`app/idea/[id]/page.tsx`, `app/api/card/[id]/route.tsx`). This project
does **not** have Next's Cache Components enabled (`next.config.ts` has
no `cacheComponents` flag), so it's on the "classic" caching model —
and every DB read here goes through raw `pg` queries, not `fetch()`.
Next's classic heuristic has no way to notice a raw `pg.query()` call
and silently treats such a page as fully static, prerendering it once
at build time. This was caught live via `x-vercel-cache: PRERENDER` on
the homepage — the live bar, both boards, and every idea page's rank
were frozen at whatever they were during the last deploy. **Any new
page or route you add that reads the database via `pg` needs
`export const dynamic = "force-dynamic"` too, or it will silently serve
stale data** — this won't show up as an error, only as numbers that
don't move. POST-only route handlers (`/api/like`, `/api/presence`,
`/api/score`) don't need it — Next never statically caches POST
handlers regardless of config.

**`MIN_BID` is 5, not the prototype's 4.** Corrected per explicit user
instruction to match the (unseen by Claude) terms page. Single source
of truth is `lib/board-ui.ts`'s `MIN_BID`/`MAX_BID` — don't hardcode
the number anywhere else.

**`ranges()`'s round-tier fallback (fixed 2026-08-28).** With, say, 16
entries, the round "Top N" steps are 3/10/20/50 — `total >= 20` and
`total >= 50` are both false, so the tiers stopped at "Top 10" and
rows 11–16 were permanently unreachable through the UI (there was no
"show everything" option). This isn't specific to 16 — the same gap
exists at every boundary (e.g. 35 entries stalls at "Top 20", 7
entries stalls at "Top 3"). Fixed by tracking the largest round tier
actually emitted and, whenever the total is still past it (and not
already in the >50 chunked-pagination branch), appending one final
tier labeled with the real count — `All 16`, not another round number,
since none fits. Verified with a standalone script across totals
1/2/3/7/10/16/20/35/50/51/100/101 before touching the DB, then again
live against 17 real submissions (`Top 3 | Top 10 | All 17`, clicking
it actually renders all 17). One function, shared by both boards'
`RangeSelector`s, so both were fixed by the one change.

**Full Merit Board page (`/board`, added 2026-08-28).** "See the Full
Board →" used to be `href="#"` — there was no real destination, it
just scrolled to a section already on screen. `app/board/page.tsx` +
`components/FullBoardView.tsx` are a real page now: every Merit Board
entry (not the homepage widget's slice), same category filter/range
selector/like-toggle behavior, `force-dynamic` for the same reason
every other DB-reading page is. Deliberately reuses `SiteHeader`/
`SiteFooter` (not `LegalLayout` — that's built for prose sections, not
board rows) plus `home.css`'s existing `.row`/`.tab`/`.ranges`/`.heart`
classes and `legal.css`'s `.legal-view`/`.legal-lede` page-head
treatment for the title/lede — no new stylesheet needed. There's no
equivalent full-list page for the Highlight Board; never requested.

**Likes dedupe by device ID *and* IP**, as two separate unique DB
indexes (`likes_submission_device_idx`, `likes_submission_ip_idx`) —
a new row is rejected if *either* already matches for that idea, not
just one. No accounts exist, so this is what "one like per person"
means without them.

## Highlight Board payment flow (Dodo Payments — now live mode)

Built end-to-end and verified against Dodo's *test*-mode API (real
checkout sessions created, a real signed webhook activated a placement,
an amount-mismatch case was flagged not activated, a refund removed
it, a forged signature was rejected — all confirmed against the actual
`highlights` table and the actual rendered homepage board, not just
code review). **Switched to `DODO_ENVIRONMENT=live_mode` on
2026-08-27**, with all four `DODO_*` env vars updated to live
credentials on Vercel — `lib/dodo.ts` used to hard-refuse to start
under `live_mode` at all (a deliberate first-build safety guard); that
guard was removed on request once going live was confirmed intended.
The flow itself is unchanged — same code path, same webhook, same
`highlights` table — only the credentials and Dodo's own environment
differ now. The synthetic webhook tests above were never rerun against
the live product (there's no safe way to synthesize a *real* Dodo
payment for that), so live mode is running on the strength of the
test-mode verification plus code being identical, not a fresh
live-mode test pass.

**Flow:** `/highlight/[id]` (real checkout form, reuses AmountStepper
verbatim) → POST `/api/highlight/checkout` writes a `pending` row in
`highlights` *first*, then creates a Dodo checkout session with the
pending row's id in `metadata.highlightId` and the amount (cents) as
the PWYW `product_cart[0].amount` → redirect to Dodo's hosted checkout
→ Dodo redirects back to `/highlight/[id]/done?highlightId=N`, which
polls `GET /api/highlight/status/[id]` every ~2.5s.

**The webhook (`/api/dodo/webhook`), not the redirect, is what actually
places anything on the board.** It verifies the signature via the
SDK's `client.webhooks.unwrap()` (built on `standardwebhooks`, the same
Svix-compatible scheme — no need to hand-roll HMAC verification). On
`payment.succeeded` it activates the row (`lib/highlights.ts`'s
`activateHighlight`), but only if the amount Dodo actually charged
matches what the row was created for — a mismatch flags the row and
leaves it `pending` rather than activating, logged as an error. On
`refund.succeeded` it flips an `active` row back to non-board. A bad
signature or a handler exception both still return `200` immediately
(logged first) — Dodo retries on non-2xx, and nothing here would
behave differently on a retry, so there's no reason to trigger one.

**Idempotency has no separate dedupe table** — it falls directly out of
`activateHighlight`'s `WHERE status = 'pending'` guard (a row can only
ever transition pending→active once) and `deactivateHighlightByPaymentId`'s
`WHERE status = 'active'` guard. A replayed webhook delivery just finds
nothing left to update.

**Reconciliation has no cron job.** `/api/highlight/status/[id]` calls
`reconcileHighlight()` on every poll of a still-`pending` row — it asks
Dodo directly (checkout session → payment) and activates through the
exact same `activateHighlight()` path the webhook uses. A dropped
webhook self-heals the next time the done page polls; nothing runs on
a schedule.

**The `highlights` table stores cents** (`amount_cents`), not the
dollars the old empty placeholder table had — `getHighlightBoardRows`/
`getTopHighlightAmount`/`getLiveStats` in `lib/get-board-data.ts` all
divide by 100 on the way out. `MAX_BID` moved from the old placeholder
value of 500000 to **999999** — Dodo's product itself has no configured
maximum (their dashboard doesn't offer one), so this ceiling is
enforced entirely in this codebase, at three separate points: the
stepper/clamp in `lib/board-ui.ts`, the server-side clamp when
`/highlight/[id]` loads, and again right before checkout-session
creation in the API route — never trust a client-supplied amount past
that last point.

**Claim strip Highlight button (the homepage one, not on a scored
idea).** The problem it solves: the homepage claim strip lets someone
pick an amount before they've submitted anything, so there's no idea
id yet to send them to a real `/highlight/[id]` with. Two different
behaviors depending on whether `RateMyIdeaApp`'s `result` state is set:

- **No idea scored yet** (`result` is null): the button is a plain
  `<button>`, not a link. Clicking it calls
  `rememberHighlightAmount(bidAmount)` (writes to `localStorage` via
  `lib/highlight-amount-memory.ts`) and
  `submitFormRef.current?.focusForHighlight()` — an imperative handle
  `SubmitForm` exposes via `useImperativeHandle`/`forwardRef` that
  smooth-scrolls its textarea into view, focuses it, and reveals a
  `.highlight-nudge` line ("Score your idea first, then you can
  highlight it.").
- **An idea is already on screen** (`result` is set, e.g. right after
  scoring or on a shared `/idea/[id]` link): the button is a real
  `<a href={\`/highlight/${result.id}?amount=${bidAmount}\`}>` — there's
  a real id, so it just goes straight there like any other real
  Highlight link.

`app/highlight/[id]/page.tsx` passes `initialAmount` as `number | null`
to `HighlightCheckout` — `null` specifically means "no real `?amount=`
was in the URL" (not "defaulted to MIN_BID"), which is the signal
`HighlightCheckout` uses to call `consumePendingHighlightAmount()` in a
`useEffect` on mount (not a lazy `useState` initializer — same
hydration-mismatch reasoning as the theme toggle: `localStorage` isn't
available during SSR, so reading it at render time risks server/client
output disagreeing). That function reads-and-clears the remembered
amount in one call, so it only ever pre-fills once — a months-old
choice can't silently resurface on some unrelated later purchase.

Verified end-to-end in the browser, not just by reading the code: set
the stepper to a non-default amount on the homepage, clicked
Highlight, confirmed the nudge line/focus/scroll/`localStorage` all
fired, scored a real idea, followed its real "Highlight this idea"
link (no `?amount=` in that URL), and confirmed `/highlight/[id]`
pre-filled the remembered amount and cleared it from `localStorage`
afterward. Separately confirmed the already-scored-idea path renders a
real `<a href="/highlight/N?amount=...">`, not the button.

## Visitor counter (`/stats`, added 2026-08-29)

A new `visitors` table (`visitor_key TEXT PRIMARY KEY, first_seen
TIMESTAMPTZ NOT NULL DEFAULT now()`), **deliberately separate from
`presence`**, for two reasons worked through before building this
(the user asked for this reasoning explicitly, up front):

1. `presence.last_seen` is overwritten on every heartbeat ping — that
   IS its job (the "N here now" figure, filtered to the last 60
   seconds). There's no immutable "first seen" in there, and bolting
   one on would mean a table whose whole purpose is ephemeral/recency
   also becomes the permanent historical record a visitor count needs.
   `presence` has already been wiped once (the pre-launch reset) — a
   visitor counter must never be that disposable.
2. The presence heartbeat only ever fires from `RateMyIdeaApp.tsx` —
   i.e. only the homepage and `/idea/[id]`. A real site-wide visitor
   count needs every page, including `/terms`, `/stats`, `/board`,
   `/highlight/[id]` — pages that never ping presence at all.

**How it's counted**, per `components/VisitTracker.tsx` (mounted once
in `app/layout.tsx`, renders nothing): one `POST /api/visit` per real
page load, not per page — the root layout doesn't remount on soft
client-side navigations (though in practice almost every internal link
in this app is a plain `<a>` anyway, so nearly all navigation here is
already a hard reload — the "once per mount" property matters more if
that ever changes). `lib/visitors.ts`'s `recordVisit()` is
`INSERT ... ON CONFLICT DO NOTHING`, so firing more than once per
visitor over time is harmless — verified directly: reloaded the
homepage and visited `/terms` from the same browser, row count stayed
at 1.

**The key**: `device:<id>` for a normal persisted `getDeviceId()`
value (the same one `likes`/`presence` already use), or `ip:<address>`
when the client's id is the ephemeral, non-persisted fallback
`getDeviceId()` returns when `localStorage` throws (a fresh value
every call — trusting it as a stable id would overcount one blocked-
storage visitor as many). `lib/device-id.ts` exports
`isEphemeralDeviceId()` — anything matching that (or a missing
`deviceId` entirely) falls back to IP in `app/api/visit/route.ts`.
Verified directly: POSTed a fake `session-...` id and confirmed it
landed as an `ip:` row, not a `device:` one.

**Day count**: `Math.max(1, Math.floor(elapsedMs / 86400000))` off
`MIN(first_seen)` — whole days actually elapsed, floored, never below
1, so day one reads "1 day" and it only ticks over to "2 days" once a
full 24h has genuinely passed (not the moment the calendar date
changes). `null` (tile note omitted entirely) when the table is empty,
rather than showing "in 0 days".

**No backfill, by construction, not by a special case**: the table
started genuinely empty at deploy time, so the count and day-clock
both start from real rows only — there was nothing to backfill or
estimate, the empty table already guarantees that. Test rows created
while verifying this locally (same shared DB as production) were
deleted before deploying, specifically so production's real count
starts from real traffic, not from this session's own testing.

## Idea submission paused (2026-08-29)

The Anthropic account ran out of API credit (same account, same root
cause as the deep-dive report generator's blocked validation below —
one balance, spent across both). Real visitors were getting a raw 500
trying to score an idea, so submission was switched off deliberately
rather than left broken, per explicit instruction. **One boolean is
the entire kill switch**: `lib/scoring-status.ts`'s `SCORING_PAUSED`
(currently `true`) plus a shared `SCORING_PAUSED_MESSAGE` string so
the two surfaces below can't drift apart. Flip it to `false` once
credit is back — nothing else needs to change, nothing else reads it.

**Two places check it, nothing else does:**

1. **`components/SubmitForm.tsx`** — the `<h1>` heading ("It all
   starts with an 'idea'") always renders unconditionally, per
   instruction to keep it. Everything below it (the highlight nudge,
   the textarea/count/submit form, the caveat line) is swapped for a
   `.paused-notice` div showing the message, styled in `app/home.css`
   to match the textarea's own card look it replaces — same
   `var(--panel)` background, `var(--line)` border, 16px radius, blur
   — rather than inventing a new visual language for something meant
   to be temporary. `RateMyIdeaApp.tsx` itself is untouched — it still
   renders `<SubmitForm ref={submitFormRef} onScored={handleScored} />`
   exactly as before; the branch lives inside `SubmitForm`.
2. **`app/api/score/route.ts`** — checks `SCORING_PAUSED` first, before
   parsing the request body or touching the DB, and returns
   `{ error: SCORING_PAUSED_MESSAGE, paused: true }` at **503**, not a
   500 from a real Anthropic call that's guaranteed to fail right now.
   `/test` (known issue 1 below) posts to this same route, so it's
   covered by this one guard too — not special-cased separately.

**Verified, not just written**: full `npm run build` clean, `/api/score`
hit directly returns 503 with the clear message (confirmed via curl,
not just reading the code), and `/board`, `/idea/1`, `/stats`,
`/terms`, and `/api/card/1` all still return 200 — the boards, idea
pages, share cards, stats, and legal pages are untouched by this flag.
Checked the homepage in both light and dark mode in the browser — the
heading stays, the notice reads clearly in both themes, boards render
below it as normal.

## Deep-dive report (replacing the Highlight Board — generation engine only, 2026-08-29)

The new paid product: a three-page, ~1,500-word PDF deep-dive on one
already-scored idea (₹995 / $9.99), replacing the Highlight Board.
**Only the generation engine exists so far** — `lib/generate-report.ts`'s
`generateReport(submissionId)` — plus a dev-only raw-JSON preview route.
No PDF rendering, no payment, no UI, no `reports` DB table (nothing is
persisted; every preview call is a fresh, billed generation). The
Highlight Board itself is completely untouched — explicit instruction
was to build the new product before touching the old one.

**Model: Sonnet, not Haiku** (`claude-sonnet-5`, not a dated snapshot —
dated ids like `claude-sonnet-4-6-20251114` are stale training-data
priors, not real ids). Explicit instruction: paid deliverable, quality
over cost. `output_config: {effort: "medium"}` — see the timing note
below for why this isn't "high". Web search tool
(`web_search_20260318` — the SDK's newest dated variant, not the
`20260209` a cached reference table suggested; "prefer the latest type
variant your model supports").

**The report ARGUES a score that already exists — it doesn't re-score.**
`REPORT_SYSTEM_PROMPT` (`lib/report-prompt.ts`) imports
`SCORING_SYSTEM_PROMPT` directly and embeds it verbatim, specifically
so the per-dimension reasoning on page 1 stays consistent with the
rubric that actually produced the score sitting in `submissions` — a
second, hand-copied rubric text would drift the moment either prompt
changes. The model receives the idea, category, total, verdict, and
full five-dimension breakdown as already-fixed facts and is told not
to recompute them.

**Timing: measured 3-5 minutes per report initially, not the 30-60s
target — root-caused and improved, not silently accepted.** Two real
issues, not one:

1. **Malformed JSON on some runs, causing a full expensive retry**
   (doubling wall-clock time on top of everything else). Root cause:
   with web search in the mix, Claude doesn't reliably confine itself
   to "the whole response is one JSON object" — it may write a
   preamble text block, and/or trailing commentary in a separate block
   after the JSON, despite explicit instructions not to. The original
   code took `response.content.find(b => b.type === "text")` — the
   *first* text block — which during testing was sometimes a preamble,
   not the JSON. Fixed in two layers: `runReportGeneration()` now
   concatenates *every* text block instead of trusting one position,
   and a new `extractJsonObject()` takes the substring from the first
   `{` to the last `}` rather than requiring the whole string to
   parse — tolerates stray prose on either side, wherever it lands.
2. **8 sequential real web searches at `effort: "high"` is just
   slow** — each search is a real network round trip, and adaptive
   thinking at "high" adds real time on top. `MAX_SEARCH_USES` dropped
   8 -> 5 and effort dropped `"high"` -> `"medium"` (the documented
   cost/time step-down "where quality holds" for non-agentic work) —
   measured single-pass runs after both fixes: 2.6min and 1.6min. Still
   over the 30-60s target, but roughly half the original time, and the
   output quality at "medium" was not visibly worse in this test batch.
   **If 30-60s is a hard requirement, not just a target, the next lever
   is cutting `MAX_SEARCH_USES` further (2-3) or capping search result
   count per call** — not attempted here since it starts trading away
   real verification, which was the explicit point of enabling search
   at all. Left as a decision for whoever picks this up next.

**A real accuracy-rule violation, found in 1 of 3 test runs, not fixed
yet — flagged prominently, this is the most important finding from
this test batch.** For the mid-score idea (id 17), the model's own
`web_search_tool_result` blocks contained genuine, directly relevant
hits — `Intelligems` (pricing testing) and `Triple Whale` (ecommerce
analytics), both real, specific competitors verified by the code's own
independent extraction of `sources` (proof search worked: 40 real
result URLs across 5 real queries). But the model's own JSON output
left `page2.existingPlayers` **empty** and claimed in
`noPlayersFoundNote`: *"Live web search was unavailable during this
session's research pass"* — false; search demonstrably ran and found
exactly the kind of result the report needed. It then named Shopify,
Klaviyo, and Stripe **from memory, in prose**, which
`REPORT_SYSTEM_PROMPT` explicitly forbids ("never name one from
memory"). The other two test runs (low score id 34, high score id 35)
correctly cited real, sourced competitors with no such issue — so this
looks like an intermittent model-following gap, not a broken
integration (the tool-use plumbing is confirmed working via the
independently-extracted `sources`), most likely because the prompt
never shows a *worked example* of citing one of the URLs already in
hand as `sourceUrl` — it only describes the rule abstractly. Recorded
here rather than silently patched: worth a prompt revision (a concrete
example) and a rerun across more ideas before this is trusted for a
paid product, not something to wave off as one-off noise.

**Verified before showing output**: three real reports generated end
to end — a real low-scoring idea (id 34, score 12), a real mid-scoring
one (id 17, score 38), and one temporary high-scoring test row
(inserted directly by SQL, not through the real scorer — text reused
from `scoring-spec.md`'s own "payments infrastructure for an
underserved country" calibration anchor, since nothing genuinely
high-scoring exists in the live data yet) to get real coverage of the
70s range as asked. The temporary row was deleted immediately after
its report generated — it was never a real submission and never
visible on any board.

### Structural accuracy fix (2026-08-29, same day) — id 17's failure, and a blocked validation

The id-17 failure above ("Live web search was unavailable" while real
results existed) was fixed structurally, not just reworded in the
prompt, per explicit instruction ("fix it structurally, not just in
the prompt"):

1. **A worked citation example** added to `REPORT_SYSTEM_PROMPT`
   (`lib/report-prompt.ts`) — a concrete search result (`Triple Whale`,
   a real title+url pair) walked through into exactly the
   `existingPlayers` entry it should produce, plus an explicit
   instruction not to write "search was unavailable" when tool calls
   actually returned results.
2. **Code-level verification, not just a better prompt.**
   `lib/generate-report.ts` gained `sanitizeAndVerify(content, sources)`,
   run after every generation, before anything is returned:
   - `normalizeDomain()` extracts a comparable domain from a URL;
     every `existingPlayers[].sourceUrl` is checked against the domains
     of the *real* `sources` this generation's own web searches
     returned (extracted independently from `web_search_tool_result`
     blocks, the same mechanism that caught the original id-17 bug).
     Any competitor whose `sourceUrl` doesn't map to a real result
     domain is **stripped**, not trusted.
   - `findLikelyMissedCompetitor()` — if `existingPlayers` ends up
     empty, checks whether any search query looks like a targeted
     brand search whose own domain shows up in the results (e.g.
     querying "Triple Whale ecommerce analytics" and getting a
     triplewhale.com hit back) — a heuristic sign the model had a
     competitor in hand and dropped it. `GENERIC_HOSTS` (wikipedia,
     g2, crunchbase, techcrunch, forbes, etc.) is excluded from this
     check so an incidental mention on a generic aggregator doesn't
     falsely trigger it.
   - `claimsSearchUnavailable()` regex-catches the exact false-claim
     pattern from id 17 ("search was unavailable/down/failed") and
     distinguishes it from a legitimate "no relevant results found."
   - Any of the above failing (all players stripped, a likely-missed
     competitor detected, or a false unavailability claim) rejects the
     generation with a specific reason.
3. **A hard 2-attempt cap** (`MAX_ATTEMPTS = 2` in `generateReport()`).
   A rejected first attempt retries once, with the specific failure
   reason fed back into the prompt ("your previous attempt failed
   verification: X — follow the worked citation example exactly").
   A second rejection throws rather than ever returning an unverified
   report — no silent fallback to unsourced content for a paid
   product.

Typechecked, linted, and `npm run build` clean after the rewrite.

**Validation was ordered next — ten reports across the score range,
checking the pass rate unaided — and it is INCOMPLETE, blocked by a
real external problem, not abandoned.** Set up: 7 real submissions
spanning the live score range (ids 34/2/3/15/1/17/11, scores 12–48)
plus 3 temporary SQL-inserted rows to cover the 60s/70s/80s bands
(ids 36/37/38, deleted immediately after this test — see cleanup
below), fired as 3 concurrent batches. Result: **the Anthropic account
ran out of API credit balance mid-run** ("Your credit balance is too
low to access the Anthropic API") — confirmed from the dev server's
own logs, not assumed: the first 3 requests in flight when the balance
hit zero failed after 77–82s (mid-stream, having already opened an
SSE connection and done real work), and every request after that
failed instantly (~1s, rejected before a stream even opened). This is
a billing/console issue on the Anthropic side, not a code bug — I
cannot add credit myself; that needs the user at
console.anthropic.com → Plans & Billing.

**Only 1 of the 10 reports actually completed: id 15 (score 26,
marketing-dashboard-plus-agency-directory idea).** It passed
verification cleanly on the first attempt — no retry, nothing
stripped: all 5 named competitors (AgencyAnalytics, Whatagraph,
Improvado, Clutch, UpCity) had a `sourceUrl` whose domain matched a
real search result the same generation had actually returned. One
clean data point in favor of the fix, not the ten-report confirmation
that was asked for — **do not treat this as "near 100% verified,"
it's one sample.** The other 9 reports need regenerating once the
Anthropic account has credit again; nothing about the code needs to
change first.

**Cleanup done regardless of the blocked test**: the 3 temporary rows
(36/37/38) were deleted immediately (`submissions` count back to 18,
confirmed by direct query), and the throwaway test script used to fire
the 10 requests was deleted — it was never committed to git.

### UX flow recommendation for the paid product (asked 2026-08-29, design only — not built)

At 1.5–3 minutes per report, a buyer who just paid should not sit on a
blocking spinner. Recommendation: **take payment, generate in the
background, and let the buyer land on a status page that also polls**
— this mirrors the existing Highlight flow's own pattern
(`/highlight/[id]/done` polling `GET /api/highlight/status/[id]`,
which calls `reconcileHighlight()` on every poll) rather than
inventing a new UX primitive. Concretely: Dodo webhook fires on
payment success → write a `pending` row to a new `reports` table →
kick off generation → redirect/land the buyer on `/report/[id]/done`,
which polls a status endpoint and shows the PDF (or a download link)
the moment it's ready, with a "we'll also email it to you" fallback
for anyone who closes the tab. This needs two things that don't exist
in this codebase yet, and neither should be assumed trivial:

1. **No email-sending infrastructure at all** — no provider, no
   templates, no send path anywhere in the code. Needs to be picked
   (Resend, Postmark, SES, etc.) and built from scratch if "email the
   PDF when ready" is part of the flow, not adapted from something
   existing.
2. **A webhook handler can't block for 1.5–3 minutes.** The Dodo
   webhook (`/api/dodo/webhook`) is a normal Vercel serverless request/
   response cycle — it has to return quickly. Kicking off report
   generation from inside it needs either `waitUntil()` (extends
   execution past the response, still bounded by the function's max
   duration) or a real queue/cron mechanism — not the pattern
   `activateHighlight`/`reconcileHighlight` use today, which complete
   in well under a second.

Not built — explicitly gated behind the 10-report validation above
finishing at a real pass rate first.

## Half-finished / explicitly deferred (by instruction, not by accident)

- **`app/highlight/page.tsx` (the bare `/highlight?amount=` placeholder)
  is now orphaned — nothing links to it any more.** It used to be the
  homepage claim strip's Highlight target before an idea existed to
  attach it to; that button now either nudges the visitor to the
  submission box (no idea yet) or links straight to a real
  `/highlight/[id]` (idea already on screen) — see "Claim strip
  Highlight button" below. The file itself was left in place rather
  than deleted, since removing a route is a decision worth a separate
  ask rather than an assumed cleanup. Flagged again in Known issues.
- **One banner link is still a real placeholder**: the Highlight
  Board banner's "Get Featured →" (`components/RateMyIdeaApp.tsx`),
  still `href="#"`. Never specced or requested; not touched. The Merit
  Board banner's "See the Full Board →" is real now — see "Full Merit
  Board page" above.
- **Result view's dark theme exists** (see above) — don't reintroduce
  the "no dark mode" gap that used to be documented here; it's been
  fixed.
- Stats page, legal pages, and "How scoring works?" are now all real,
  built pages, linked from everywhere they should be — this line used
  to say otherwise; it didn't get updated for a few requests after
  they shipped. If a page is later added and this file isn't updated
  to match, don't trust this section over what's actually in `app/`.

## Known issues / things to watch

1. **`/test` page is unauthenticated and hits the real paid API.**
   Flagged early, never addressed. Should be removed or locked down
   before real public traffic arrives — right now anyone who finds the
   URL can burn API credits (rate-limited, but still).
2. **Two plaintext secret files still sit in the project folder**:
   `API Key.txt`, `env.txt` (the original Anthropic key and DB
   password, from before `.env.local` existed). They're gitignored now
   so they won't reach GitHub, but they're still sitting on disk in
   plain text. Recommended for deletion multiple times across this
   project's history; never actioned.
3. **`Coming Soon Files/` directory** (contact/index/refunds/terms
   .html, a `page.css`, a `files.zip`) is sitting in the repo root,
   predates all of this work, has unclear provenance, and isn't
   integrated into the Next.js app in any way. Committed as-is since
   nobody said what it's for. Ask before assuming it should stay,
   move, or go.
4. **Temperature-0 non-determinism**, documented in `scoring-spec.md`'s
   "Known limitations" section: the same idea, scored twice, produced
   identical verdict text but different totals (77 vs. 73) once. The
   hash cache fully protects *identical* re-submissions; near-identical
   ones (differing only in stripped punctuation/case) hash differently
   and may drift a few points. Marked "revisit before launch," not
   fixed.
5. **This session's browser-testing environment reports
   `document.hidden === true`** (the preview pane isn't actually
   composited), which fully throttles `requestAnimationFrame` and
   delays style recomputation. This affected verifying the result
   page's count-up animation (had to verify the easing math
   independently in Node instead of watching it render) and means
   `element.dispatchEvent(new Event(...))` doesn't reliably trigger
   React's synthetic handlers here — real `computer` tool clicks/typing
   do work. Not a app bug; a quirk of this specific tooling sandbox.
   Worth knowing before assuming a "failed" interaction test means
   broken code.
6. **The Highlight Board's optional URL validation is best-effort, not
   airtight.** `lib/highlight-url.ts` blocks a fixed list of known
   shortener/invite-link hosts and common affiliate query params, and
   does a `HEAD` request with `redirect: "manual"` to catch a URL that
   itself 3xx-redirects — but a shortener not on the list, or a domain
   that redirects only on GET (not HEAD), gets through. This is
   mechanical enforcement of terms.html §07's rules, not abuse review.
7. **Git history starts from one large initial commit** (`9305aa9`) —
   this project had no git repository for most of its build; `git init`
   happened only when the Vercel CLI's device login broke. Everything
   before that point has no per-change history, just the state of the
   world at that moment.
8. **The deep-dive report generator's id-17 accuracy failure (false
   "search was unavailable" claim) has a structural, code-level fix
   now** (`sanitizeAndVerify`/`findLikelyMissedCompetitor`/
   `claimsSearchUnavailable` + a hard 2-attempt cap, see "Structural
   accuracy fix" in "Deep-dive report" above) **but the 10-report
   validation pass is incomplete — blocked by the Anthropic account
   running out of API credit balance mid-test, not by a code issue.**
   Only 1 of 10 sample reports actually ran (id 15, passed cleanly).
   **Do not build anything on top of the report generator, and don't
   trust it "near 100% verified," until: (a) credit is added at
   console.anthropic.com, and (b) the remaining ~9 reports across the
   score range are generated and checked** — this was the user's
   explicit gate before further work.
9. **The same generator runs 1.5-3 minutes per report**, not the
   30-60s originally targeted — improved from an initial 3-5 minutes
   (see "Deep-dive report" above for the two fixes and what's left to
   try if 30-60s turns out to be a hard requirement). Also relevant to
   the UX-flow question the user asked in the same request as the
   accuracy fix — see that section for the recommendation (background
   generation + email/poll, not a blocking wait) and the two real gaps
   it surfaces: **no email-sending infrastructure exists in this
   codebase at all**, and a Vercel serverless webhook handler can't
   just block for 1.5+ minutes — background generation needs
   `waitUntil()` or a queue/cron mechanism, not the request/response
   cycle the webhook itself runs on.

## Environment / deployment

- **Model:** `claude-haiku-4-5-20251001`, temperature 0, max 400 tokens.
- **Deploy:** `git add -A && git commit -m "..." && git push` — Vercel
  auto-builds on push to `main`. No CLI involved or needed.
- **First push auth:** Git Credential Manager pops a browser window for
  GitHub login on first push from a fresh session/machine; cached after
  that.
- **Env vars** (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL`,
  `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRODUCT_ID`,
  `DODO_ENVIRONMENT`, optionally `DAILY_SCORE_CAP`) are set directly on
  the Vercel project dashboard, not derived from `.env.local` at deploy
  time — `.env.local` is gitignored and only matters for local dev.
  `DODO_ENVIRONMENT` is `"live_mode"` as of 2026-08-27 (all four
  `DODO_*` vars hold live credentials) — see "Highlight Board payment
  flow" above for how that switch happened and what wasn't re-verified
  because of it. **The Dodo webhook endpoint (`/api/dodo/webhook`)
  also needs to be registered in the matching (now live-mode) Dodo
  dashboard** pointing at
  `https://ratemyidea-flax.vercel.app/api/dodo/webhook` — that
  registration lives on Dodo's side, not in this repo, so it doesn't
  travel with a redeploy or a fresh clone, and a test-mode-dashboard
  registration from before the switch does nothing for live traffic.
- **Local dev:** `npm run dev` (or the `ratemyidea-dev` launch config).
  Note Next's docs say pages are *always* dynamically rendered in dev
  regardless of `force-dynamic` — the PRERENDER bug above was
  invisible locally and only showed up in production.
