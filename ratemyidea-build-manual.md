# RateMyIdea — Build & Launch Manual

**Two boards. One joke. Fourteen days.**

---

## The concept in one paragraph

Anyone can submit an idea for free and get a score out of 100 plus one brutal line about it. Every scored idea gets a permanent public page and a place on the **Merit Board**, ranked purely by score, where money changes nothing. Alongside it sits the **Bought Board**, where anyone can pay to sit at the top, and everyone can see they paid. The homepage headline is the live gap between the two.

> **Ranked #1 by merit:** *"Marketplace for unused gym equipment"* — scored **94**
> **Ranked #1 by money:** *"AI for your AI's AI"* — scored **31**, paid **$4,200**

That gap is a fresh screenshot every day, generated automatically, forever.

---

## Why this works

Three engines, each doing a different job.

**The free score is the traffic engine.** No signup, no payment, fifteen seconds. It produces a share card that carries your domain everywhere.

**The Bought Board is the revenue engine.** Companies with marketing budgets pay for rank. Not individuals — individuals fuel the free side. Anyone who pays you must be able to justify it as ad spend.

**The gap is the content engine.** You never have to write a post. The site writes them for you, daily, and each one is funnier than anything you'd script.

The critical difference from your original pricing ladder: on the Bought Board, **the price rises because other people decide it should.** You never set it. Rising prices become proof of demand instead of a tax on arriving late.

---

## PART ONE — WHAT TO BUILD

### 1. The submission box

One field. Max 280 characters. Placeholder: *"Describe your idea. Be honest, we'll be worse."*

No signup. No email. No account. Every field you add costs you a percentage of the funnel that never comes back.

### 2. The score

Five dimensions, 100 points total. Publish them openly.

| Dimension | Points | Question |
|---|---|---|
| Originality | 25 | Has this been built 400 times already? |
| Willingness to pay | 25 | Would a stranger hand over money? |
| Weekend-copy risk | 20 | Could a competent dev clone it in two days? |
| Real problem | 20 | Does this hurt someone today? |
| Delusion index | 10 | How much of this is fantasy? |

**Two engineering requirements that decide whether this survives week one:**

**Determinism.** Same idea must always produce the same score. Use temperature 0, a frozen prompt, and cache results against a hash of the normalized text (lowercased, punctuation and whitespace stripped). If someone resubmits and gets 62 after getting 41, they will post the screenshot and your credibility is gone by lunch.

**Spread.** If everything lands between 70 and 85, nobody shares. Instruct the model explicitly: *median idea scores 40; scores above 80 should be under 5% of submissions; scores below 20 are allowed and encouraged.* Then test against 50 seed ideas and check the actual distribution before you launch. If it clusters, tighten the prompt until it doesn't.

Use Claude Haiku for this. Roughly $0.002 per score — 50,000 scores costs about $100.

### 3. The line

This is the real product. The score is a number; the line is what gets screenshotted.

Three rules, enforced in the prompt:

1. **It must quote or reference something in their actual submission.** Generic burns are worthless. "This is a solution looking for a problem" could apply to anything and will be called out as lazy.
2. **Punch at the idea, never the person.** Nothing about who they are, only what they wrote.
3. **One sentence. Under 20 words.**

Hard guardrails: no cruelty involving anyone's identity, appearance, background or beliefs. Filter these at the prompt level and again on output. One screenshot of your site saying something ugly about a person ends the project.

### 4. The share card

A 1200×630 open-graph image, auto-generated per idea. Contains:

- The score, very large
- The idea in one line
- The savage line
- Merit rank: *#412 of 3,847*
- Your domain

Use `@vercel/og`. This asset is roughly 80% of your growth. Spend a full day on it and make it good enough that people post a score of 12 proudly.

### 5. The Merit Board

Public list, ranked by score. Filterable by category. Money cannot touch it, and say so on the page — that promise is what makes the Bought Board funny instead of grubby.

### 6. The Bought Board

Copy outbid.lol's ruleset. It's well designed and there's no reason to reinvent it.

- Whole US dollars. **$5 minimum.** $1 increments.
- Taking #1 costs at least $1 more than the current top bid.
- Raising your own listing: you pay only the difference.
- Equal bids — the earlier one keeps the higher rank.
- Payment completing is what claims the rank.
- **Non-refundable. State this in plain language at checkout, not in a terms page.**
- No chat/invite links, no NSFW, no link shorteners, no affiliate parameters.

Add **category boards** — one paid #1 slot per category, 20 or so categories. This matters more than it looks: it creates twenty affordable "wins" instead of one expensive one, which multiplies your transaction count at the low end.

### 7. The gap headline and the activity feed

The homepage hero is the two #1s side by side with the score difference between them.

Below it, a live feed: *"idea #4,201 just scored 8"*, *"acme.io took #3 for $610"*. Motion signals life. A static leaderboard looks abandoned.

---

## PART TWO — THE STACK

| Layer | Use | Why |
|---|---|---|
| Framework | Next.js on Vercel | OG image generation is native |
| Database | Neon or Supabase Postgres | Free tier covers launch |
| Scoring | Claude Haiku, temperature 0 | Cheap, fast, deterministic enough |
| Cards | `@vercel/og` | Built in |
| Analytics | Plausible or Datafast | Public stats page is itself shareable |

### Payments — read this before you build anything

You are in India. Stripe is not straightforwardly available to a solo Indian developer, and Razorpay's international card acceptance needs approval you won't get in a week.

**Use a merchant of record instead.** Lemon Squeezy, Paddle, or Dodo Payments. They accept international cards, handle sales tax and VAT for you, and pay out to an Indian bank account. Slightly higher fees, dramatically less friction.

**Do this on day one, not day six.** Approval and payout setup can take several days and it is the single most likely thing to delay your launch.

### Cost to launch

Domain (~$12) + API credits (~$50) + hosting (free tier). **Under $100.**

---

## PART THREE — THE 14-DAY PLAN

### Days 1–2 · Core loop

Submission box → score → savage line → public idea page → share card. Merit Board listing.

Apply for your merchant-of-record account today.

**Done when:** you can submit an idea on a live URL and get a card that renders correctly when pasted into X.

### Day 3 · Score calibration

Run 50 test ideas through. Chart the distribution. Tighten the prompt until the median sits near 40 and the tails are populated. Verify determinism by submitting the same idea ten times.

**Do not skip this day.** It's the difference between a site people trust and a random number generator.

### Days 4–5 · Bought Board

Payment integration, bid logic, raise-by-difference, tie handling, category boards.

Test the failure paths specifically: payment succeeds but the webhook fails, two people bid the same amount within a second, a card gets declined mid-flow.

### Day 6 · The gap engine

Homepage hero, live activity feed, category pages, public stats page.

### Day 7 · Seed the board — and build your launch story at the same time

**An empty leaderboard is a dead leaderboard.** Before you launch, score 100 ideas yourself.

Score the original pitches of famous companies. Airbnb's air mattresses. Dropbox before cloud sync was obvious. Uber as a black-car app for San Francisco. Twitter as SMS status updates.

This does two jobs at once. It fills the board, and it hands you your launch post:

> *"We built an AI that rates startup ideas. We fed it Airbnb's original pitch. It scored 34."*

That is a better hook than anything you could write about the product itself, and it's true.

### Day 8 · Launch

Order matters. Stagger it across the day.

1. **X thread, 9am IST.** Lead with the famous-companies angle, not the product. Screenshot first, link at the end.
2. **Show HN, 7pm IST** (morning US Pacific). Title it plainly: *Show HN: RateMyIdea – I scored 100 famous startup pitches with AI.* Be present in the comments all evening. HN rewards the founder answering questions more than it rewards the product.
3. **Reddit:** r/SideProject, r/Entrepreneur, r/indiehackers. Different post for each, no cross-posting the same text.
4. **Product Hunt** the following morning, not the same day. Don't split your attention.

### Days 9–14 · Feed the engine

Post the gap every single day. *"Today the money is beating merit by 63 points."* One screenshot, no commentary needed.

Post the outliers: the lowest score ever recorded, the first idea to break 90, the most expensive bid.

DM the top ten Bought Board listings and ask how the clicks are converting. Their answers are your sales material for the next ten.

---

## PART FOUR — THE MONEY

### What determines revenue

Bid size is a function of traffic. Nobody pays $500 for a spot on a board nobody sees. So the sequence is fixed: **traffic first, bids follow.** Do not chase the second before the first exists.

### Honest scenarios

| Outcome | Visitors | Listings | Revenue |
|---|---|---|---|
| Flat | under 20,000 | ~80 | $500–2,000 |
| Modest | 100,000 | ~400 | $8,000–20,000 |
| Strong | 500,000 | ~900 | $40,000–80,000 |
| Viral event | 1M+ | 1,100+ | $100,000+ |

Only the bottom row hits your target, and it requires a genuine viral event — the kind outbid.lol had. I'd put that at somewhere between 10% and 20%, and that estimate is judgement, not data.

The middle rows are the realistic expectation. Build so that $15,000 still feels like a win, because that's the likely outcome.

### The number that tells you which row you're in

**Cards shared per 100 scores, measured from day one.**

- Above 15 → the loop compounds. Push everything into distribution.
- 5 to 15 → it works but needs pushing. Improve the card and the savage line before anything else.
- Below 5 → the card isn't good enough. Stop building features. Rewrite the line prompt and redesign the card.

Revenue in week one tells you almost nothing. This number tells you everything.

---

## PART FIVE — WHAT WILL PROBABLY GO WRONG

**The scores get called random.** Someone resubmits and gets a different number. Prevented entirely by day 3's caching work. If it happens anyway, publish the rubric and the cache logic openly and turn it into a post.

**Someone gets genuinely hurt.** The line goes too far, punches at a person, or lands on someone having a bad week. Have a one-click removal for any idea page, no questions asked, visible on every page.

**Chargebacks.** People bid $500 at midnight and regret it at 9am. Non-refundable in plain English at checkout, plus an emailed receipt showing exactly what they bought. Expect 2–4% anyway and budget for it.

**Clones within 96 hours.** Three outbid.lol clones appeared inside its first week. Your defence isn't the mechanic, it's the corpus — thousands of scored ideas with permanent pages that nobody can copy. Which means volume in week one matters more than features.

**It just doesn't spread.** The most likely outcome. If the share ratio is under 5 by day 3, the concept hasn't landed. Give it one hard rewrite of the card and the line. If day 6 is still under 5, stop. Total loss is under $100 and a fortnight, which is exactly why this is worth trying.

---

## The build order, compressed

1. Merchant-of-record application — **today**
2. Submission → score → card → public page
3. Calibrate the score distribution
4. Merit Board
5. Bought Board + payments
6. Gap headline + activity feed
7. Seed 100 famous pitches
8. Launch
9. Post the gap daily

Ship the free loop before the paid one. If nobody shares a free score, nobody will ever pay for a rank.
