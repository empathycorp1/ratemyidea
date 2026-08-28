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
public leaderboard (the Merit Board, ranked by score) or — eventually —
a paid one (the Highlight Board, ranked by spend). Full concept in
`ratemyidea-build-manual.md`.

## Current state

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

components/
  RateMyIdeaApp.tsx        — top-level client component: whole page shell,
                              theme toggle, form/result toggle, both boards
  SubmitForm.tsx, ResultView.tsx, CategoryTabs.tsx, RangeSelector.tsx,
  AmountStepper.tsx

app/
  page.tsx                 — homepage (force-dynamic)
  idea/[id]/page.tsx        — result page + OG metadata (force-dynamic)
  api/card/[id]/route.tsx   — share card PNG via next/og (force-dynamic)
  api/score/route.ts        — POST, scores an idea
  api/like/route.ts, api/presence/route.ts — POST, both fire-and-forget
  highlight/page.tsx        — still a PLACEHOLDER (query-param, no idea
                              attached — the homepage claim strip's
                              generic "Highlight" link; out of scope,
                              never built)
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
- **Two banner links are still real placeholders**: the Highlight Board
  banner's "Get Featured →" and the Merit Board banner's "See the Full
  Board →" (`components/RateMyIdeaApp.tsx`), both still `href="#"`.
  Never specced or requested; not touched.
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
