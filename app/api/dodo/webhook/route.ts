import { dodo, DODO_WEBHOOK_SECRET } from "@/lib/dodo";
import { activateHighlight, deactivateHighlightByPaymentId } from "@/lib/highlights";
import type DodoPayments from "dodopayments";

// This webhook is the source of placement truth — not the browser
// redirect back from Dodo's hosted checkout (see
// app/highlight/[id]/done/page.tsx, which only polls what this route
// has already written). Always acks with 200 quickly, even after a
// logged failure: Dodo retries on non-2xx, and a bad signature or a
// handler bug will fail identically on every retry, so there's nothing
// a retry storm would fix that logging + manual reconciliation
// (lib/highlights.ts's reconcileHighlight) doesn't already cover.

export async function POST(req: Request) {
  const rawBody = await req.text();

  let event: DodoPayments.UnwrapWebhookEvent;
  try {
    event = dodo.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
      },
      key: DODO_WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error("[dodo webhook] signature verification failed", err);
    return new Response("ok", { status: 200 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`[dodo webhook] handler error for event type ${event.type}`, err);
  }

  return new Response("ok", { status: 200 });
}

async function handleEvent(event: DodoPayments.UnwrapWebhookEvent): Promise<void> {
  switch (event.type) {
    case "payment.succeeded": {
      const payment = event.data;
      const highlightId = Number(payment.metadata?.["highlightId"]);
      if (!Number.isInteger(highlightId) || highlightId <= 0) {
        console.error(
          `[dodo webhook] payment.succeeded (${payment.payment_id}) missing/invalid highlightId metadata`,
          payment.metadata
        );
        return;
      }

      const result = await activateHighlight({
        highlightId,
        dodoPaymentId: payment.payment_id,
        paidAmountCents: payment.total_amount,
      });

      if (result.outcome === "amount-mismatch") {
        console.error(
          `[dodo webhook] AMOUNT MISMATCH on highlight ${highlightId}, payment ${payment.payment_id} — flagged, not activated`
        );
      } else if (result.outcome === "not-found") {
        console.error(`[dodo webhook] payment.succeeded for unknown highlight ${highlightId}`);
      } else if (result.outcome === "wrong-status") {
        console.warn(
          `[dodo webhook] payment.succeeded for highlight ${highlightId} in status "${result.status}" — ignored`
        );
      }
      // "activated" and "already-active" are the expected, silent paths.
      break;
    }

    case "refund.succeeded": {
      const refund = event.data;
      const result = await deactivateHighlightByPaymentId(refund.payment_id);
      if (result.outcome === "not-found") {
        console.warn(
          `[dodo webhook] refund.succeeded for payment ${refund.payment_id} with no matching active highlight`
        );
      }
      break;
    }

    // payment.failed / payment.cancelled / payment.processing: the row
    // just stays 'pending' (or gets marked 'failed' by reconciliation
    // once the checkout session itself reports failed/cancelled — see
    // lib/highlights.ts's reconcileHighlight). It was never placed on
    // the board, so there's nothing to undo.
    // refund.failed: the refund itself didn't go through on Dodo's
    // side — the placement stays active, nothing to do here.
    default:
      break;
  }
}
