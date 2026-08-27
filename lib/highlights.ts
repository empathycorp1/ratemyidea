import { query } from "./db";
import { dodo } from "./dodo";

export interface HighlightRow {
  id: number;
  submissionId: number;
  amountCents: number;
  url: string | null;
  companyName: string | null;
  dodoCheckoutSessionId: string | null;
  dodoPaymentId: string | null;
  status: "pending" | "active" | "refunded" | "failed";
  flagged: boolean;
}

function mapRow(r: {
  id: number;
  submission_id: number;
  amount_cents: number;
  url: string | null;
  company_name: string | null;
  dodo_checkout_session_id: string | null;
  dodo_payment_id: string | null;
  status: string;
  flagged: boolean;
}): HighlightRow {
  return {
    id: r.id,
    submissionId: r.submission_id,
    amountCents: r.amount_cents,
    url: r.url,
    companyName: r.company_name,
    dodoCheckoutSessionId: r.dodo_checkout_session_id,
    dodoPaymentId: r.dodo_payment_id,
    status: r.status as HighlightRow["status"],
    flagged: r.flagged,
  };
}

/**
 * The highest *active* placement already on the board for this idea, in
 * cents — or null if it has none. Per terms.html §05, a placement can't
 * be topped up; buying again just creates a separate entry. This backs
 * the "already on the board at $X, a new placement will appear as a
 * separate entry" nudge on app/highlight/[id], so someone paying twice
 * doesn't expect the amounts to combine.
 */
export async function getActiveHighlightAmountCents(
  submissionId: number
): Promise<number | null> {
  const rows = await query<{ amount_cents: number }>(
    `SELECT amount_cents FROM highlights
     WHERE submission_id = $1 AND status = 'active'
     ORDER BY amount_cents DESC
     LIMIT 1`,
    [submissionId]
  );
  return rows[0]?.amount_cents ?? null;
}

/** Writes the pending row *before* a Dodo checkout session is created —
 *  see app/api/highlight/checkout/route.ts. This is what metadata on
 *  the checkout session points back at. */
export async function createPendingHighlight(params: {
  submissionId: number;
  amountCents: number;
  url: string | null;
  companyName: string | null;
}): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO highlights (submission_id, amount_cents, url, company_name, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [params.submissionId, params.amountCents, params.url, params.companyName]
  );
  return rows[0].id;
}

export async function attachCheckoutSession(
  highlightId: number,
  checkoutSessionId: string
): Promise<void> {
  await query(
    `UPDATE highlights SET dodo_checkout_session_id = $2, updated_at = now() WHERE id = $1`,
    [highlightId, checkoutSessionId]
  );
}

export async function markHighlightFailed(
  highlightId: number,
  reason: string
): Promise<void> {
  await query(
    `UPDATE highlights SET status = 'failed', flagged = true, flag_reason = $2, updated_at = now() WHERE id = $1`,
    [highlightId, reason]
  );
}

export async function getHighlightById(
  id: number
): Promise<HighlightRow | null> {
  const rows = await query<Parameters<typeof mapRow>[0]>(
    `SELECT id, submission_id, amount_cents, url, company_name,
            dodo_checkout_session_id, dodo_payment_id, status, flagged
     FROM highlights WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * The webhook's activation path — the source of truth for placement.
 * Idempotent by construction: a row only ever transitions
 * pending -> active once (the WHERE status = 'pending' guard), so the
 * same "payment.succeeded" event arriving twice (or racing a
 * reconciliation call) never creates a second placement or double-
 * activates anything. If the amount Dodo actually charged doesn't
 * match what this row was created for, the row is flagged instead of
 * activated — see app/api/dodo/webhook/route.ts for why that can
 * legitimately happen and why it's never auto-corrected.
 */
export async function activateHighlight(params: {
  highlightId: number;
  dodoPaymentId: string;
  paidAmountCents: number;
}): Promise<
  | { outcome: "activated" }
  | { outcome: "already-active" }
  | { outcome: "amount-mismatch" }
  | { outcome: "not-found" }
  | { outcome: "wrong-status"; status: string }
> {
  const row = await getHighlightById(params.highlightId);
  if (!row) return { outcome: "not-found" };

  if (row.status === "active") {
    // Retried webhook delivery for a placement that's already live —
    // exactly the "arrives twice" case this must tolerate. No-op.
    return { outcome: "already-active" };
  }
  if (row.status !== "pending") {
    return { outcome: "wrong-status", status: row.status };
  }

  if (row.amountCents !== params.paidAmountCents) {
    await query(
      `UPDATE highlights
       SET flagged = true,
           flag_reason = $2,
           dodo_payment_id = $3,
           updated_at = now()
       WHERE id = $1`,
      [
        params.highlightId,
        `Amount mismatch: expected ${row.amountCents}c, Dodo reported ${params.paidAmountCents}c paid`,
        params.dodoPaymentId,
      ]
    );
    return { outcome: "amount-mismatch" };
  }

  await query(
    `UPDATE highlights
     SET status = 'active', dodo_payment_id = $2, updated_at = now()
     WHERE id = $1 AND status = 'pending'`,
    [params.highlightId, params.dodoPaymentId]
  );
  return { outcome: "activated" };
}

/** The webhook's refund path. Idempotent the same way — only an
 *  'active' row matching this payment id gets moved to 'refunded'; a
 *  repeat refund.succeeded delivery finds nothing left to update. */
export async function deactivateHighlightByPaymentId(
  dodoPaymentId: string
): Promise<{ outcome: "refunded" | "not-found" }> {
  const rows = await query<{ id: number }>(
    `UPDATE highlights
     SET status = 'refunded', updated_at = now()
     WHERE dodo_payment_id = $1 AND status = 'active'
     RETURNING id`,
    [dodoPaymentId]
  );
  return { outcome: rows.length > 0 ? "refunded" : "not-found" };
}

/**
 * Recovery path for a webhook that never arrived (dropped delivery,
 * endpoint briefly down, etc). Only meaningful for a row still
 * 'pending' with a checkout session already attached. Looks the
 * session up on Dodo directly; if Dodo confirms the underlying payment
 * succeeded, activates the row through the exact same
 * activateHighlight() path the webhook uses — so the amount-match and
 * idempotency guarantees are identical regardless of which path
 * actually placed the idea on the board.
 *
 * Called from the polling status endpoint behind
 * app/highlight/[id]/done, not on a schedule — every poll of a still-
 * pending placement doubles as a reconciliation attempt.
 */
export async function reconcileHighlight(
  highlightId: number
): Promise<HighlightRow | null> {
  const row = await getHighlightById(highlightId);
  if (!row) return null;
  if (row.status !== "pending" || !row.dodoCheckoutSessionId) return row;

  let session;
  try {
    session = await dodo.checkoutSessions.retrieve(row.dodoCheckoutSessionId);
  } catch (err) {
    console.error(
      `[highlights] reconcile: failed to retrieve checkout session ${row.dodoCheckoutSessionId}`,
      err
    );
    return row;
  }

  if (session.payment_status === "succeeded" && session.payment_id) {
    let payment;
    try {
      payment = await dodo.payments.retrieve(session.payment_id);
    } catch (err) {
      console.error(
        `[highlights] reconcile: failed to retrieve payment ${session.payment_id}`,
        err
      );
      return row;
    }
    await activateHighlight({
      highlightId,
      dodoPaymentId: payment.payment_id,
      paidAmountCents: payment.total_amount,
    });
    return getHighlightById(highlightId);
  }

  if (
    session.payment_status === "failed" ||
    session.payment_status === "cancelled"
  ) {
    await markHighlightFailed(
      highlightId,
      `Dodo checkout session payment_status: ${session.payment_status}`
    );
    return getHighlightById(highlightId);
  }

  return row;
}
