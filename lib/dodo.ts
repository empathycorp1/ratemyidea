import DodoPayments from "dodopayments";

// DODO_ENVIRONMENT is read (not hardcoded) so the value on Vercel is
// the single source of truth, but this still throws on anything other
// than the two real values the SDK accepts — a fat-fingered env var
// should fail loudly at startup, not silently misconfigure the client.
//
// This project ran test-mode-only for its first stretch, enforced by a
// guard here that refused to start under "live_mode" at all. Going
// live was a deliberate decision (2026-08-27): all four DODO_* env
// vars were switched to live credentials on Vercel and confirmed
// working against the live SDK before this guard was removed. If this
// project is ever deliberately moved back to test-mode-only, reinstate
// an explicit block on "live_mode" here rather than relying on the env
// var alone.
const environment = process.env.DODO_ENVIRONMENT;
if (environment !== "test_mode" && environment !== "live_mode") {
  throw new Error(
    `DODO_ENVIRONMENT must be "test_mode" or "live_mode", got ${JSON.stringify(
      environment
    )}. Check the env var on Vercel / .env.local.`
  );
}

if (!process.env.DODO_API_KEY) {
  throw new Error("DODO_API_KEY is not set. Add it to .env.local / Vercel.");
}

export const dodo = new DodoPayments({
  bearerToken: process.env.DODO_API_KEY,
  environment,
});

export const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID;
if (!DODO_PRODUCT_ID) {
  throw new Error("DODO_PRODUCT_ID is not set. Add it to .env.local / Vercel.");
}

export const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
if (!DODO_WEBHOOK_SECRET) {
  throw new Error("DODO_WEBHOOK_SECRET is not set. Add it to .env.local / Vercel.");
}
