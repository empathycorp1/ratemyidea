-- RateMyIdea: submissions table.
-- Backs the caching layer described in scoring-spec.md, and later the
-- Merit Board / public idea pages once those get built.

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  idea_text TEXT NOT NULL,
  normalized_hash TEXT NOT NULL UNIQUE,
  originality INTEGER NOT NULL,
  willingness_to_pay INTEGER NOT NULL,
  weekend_copy_risk INTEGER NOT NULL,
  real_problem INTEGER NOT NULL,
  delusion_index INTEGER NOT NULL,
  total INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- prompt_version: records which version of lib/scoring-prompt.ts's
-- SCORING_SYSTEM_PROMPT produced each score, so scores from different
-- prompt revisions are never silently compared as if equivalent on the
-- same leaderboard. Added as a nullable column first so this migration
-- is safe to rerun against a table that already has rows from before
-- versioning existed, then backfilled and locked to NOT NULL. All of
-- this is a no-op on a freshly created table, which already has the
-- column from the CREATE TABLE above.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS prompt_version TEXT;
UPDATE submissions SET prompt_version = 'v1' WHERE prompt_version IS NULL;
ALTER TABLE submissions ALTER COLUMN prompt_version SET NOT NULL;

-- scoring_attempts: one row per FRESH (non-cached) call to the scoring
-- API, keyed by requester IP. Backs rate limiting in lib/rate-limit.ts —
-- see that file for the actual limits. Cached hits never insert a row
-- here, since they don't call the model and cost nothing.
CREATE TABLE IF NOT EXISTS scoring_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scoring_attempts_ip_created_at_idx
  ON scoring_attempts (ip, created_at);
CREATE INDEX IF NOT EXISTS scoring_attempts_created_at_idx
  ON scoring_attempts (created_at);

-- visits: page views of a scored idea's own /idea/[id] page. Backs the
-- "N visits" figure shown on Highlight Board cards. Incremented only
-- on a real server-rendered visit (a shared link, not the submitter's
-- own pushState transition right after scoring — see app/idea/[id]).
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS visits INTEGER NOT NULL DEFAULT 0;

-- highlights: a paid placement on the Highlight Board, backed by Dodo
-- Payments checkout sessions. A row is written *pending* the moment
-- checkout is created (see app/api/highlight/checkout/route.ts) and only
-- flipped to 'active' by the webhook at app/api/dodo/webhook/route.ts —
-- the webhook is the source of truth for placement, never the redirect
-- back from checkout. Statuses: 'pending' (checkout created, not yet
-- confirmed) | 'active' (paid, live on the board) | 'refunded' (payment
-- reversed, removed from the board) | 'failed' (checkout session errored
-- before a payment was ever attempted).
CREATE TABLE IF NOT EXISTS highlights (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  amount_cents INTEGER NOT NULL,
  url TEXT,
  company_name TEXT,
  dodo_checkout_session_id TEXT,
  dodo_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Per-placement visit counter, distinct from submissions.visits (the
  -- idea page's own lifetime count). Not wired to any increment path
  -- yet — reserved for a future "visits since highlighted" figure, not
  -- part of this payment flow.
  visits INTEGER NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration safety for a deployment that already has the old (pre-Dodo)
-- shape: amount INTEGER (dollars), none of the columns above. Renaming
-- amount -> amount_cents preserves the dependent index name transition
-- below; everything else is a plain idempotent ADD COLUMN. The table
-- was always empty before Dodo integration (no payment flow existed to
-- ever write a row), so there's no dollars->cents backfill to do.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'highlights' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'highlights' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE highlights RENAME COLUMN amount TO amount_cents;
  END IF;
END $$;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS dodo_checkout_session_id TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS dodo_payment_id TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS visits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP INDEX IF EXISTS highlights_amount_idx;
CREATE INDEX IF NOT EXISTS highlights_amount_cents_idx ON highlights (amount_cents DESC);
CREATE INDEX IF NOT EXISTS highlights_status_idx ON highlights (status);
-- A payment id should only ever back one placement row. Partial (only
-- when non-null) so multiple still-pending rows without a payment yet
-- don't collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS highlights_dodo_payment_id_idx
  ON highlights (dodo_payment_id) WHERE dodo_payment_id IS NOT NULL;

-- likes: one row per (idea, device) or (idea, ip) — both are enforced
-- as separate unique constraints, so a new row is rejected if EITHER
-- the same device or the same IP already liked this idea, per the
-- dedupe rule. No accounts, so this is what "one heart per person" can
-- mean without one.
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  device_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS likes_submission_device_idx
  ON likes (submission_id, device_id);
CREATE UNIQUE INDEX IF NOT EXISTS likes_submission_ip_idx
  ON likes (submission_id, ip);

-- presence: a heartbeat row per device, upserted every ~25s while a
-- tab is open. Backs the "N here now" live-bar figure — counted as
-- devices whose last_seen falls inside a short recent window.
CREATE TABLE IF NOT EXISTS presence (
  device_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
