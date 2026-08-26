import DodoPayments from "dodopayments";

// Test mode only, deliberately. DODO_ENVIRONMENT is read (not
// hardcoded) so the value on Vercel is the single source of truth, but
// this throws rather than silently proceeding if it's ever anything
// other than "test_mode" — switching this project to live_mode is a
// decision that needs its own explicit review, not something that
// should happen because an env var got fat-fingered.
const environment = process.env.DODO_ENVIRONMENT;
if (environment !== "test_mode" && environment !== "live_mode") {
  throw new Error(
    `DODO_ENVIRONMENT must be "test_mode" or "live_mode", got ${JSON.stringify(
      environment
    )}. Check the env var on Vercel / .env.local.`
  );
}
if (environment === "live_mode") {
  throw new Error(
    "DODO_ENVIRONMENT is set to \"live_mode\" — refusing to start. This " +
      "project is test-mode only for now; if going live is genuinely " +
      "intended, this guard in lib/dodo.ts needs to be removed " +
      "deliberately, not bypassed."
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
