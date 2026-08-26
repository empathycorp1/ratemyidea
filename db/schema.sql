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

-- highlights: a paid placement on the Highlight Board. Empty for now —
-- there is no payment flow yet (explicitly out of scope), so this
-- table exists purely so the board has something real to query against
-- once highlighting is actually purchasable.
CREATE TABLE IF NOT EXISTS highlights (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS highlights_amount_idx ON highlights (amount DESC);

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
