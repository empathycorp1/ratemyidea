import { query } from "@/lib/db";
import { dodo, DODO_PRODUCT_ID } from "@/lib/dodo";
import { MAX_BID, MIN_BID } from "@/lib/board-ui";
import { createPendingHighlight, attachCheckoutSession, markHighlightFailed } from "@/lib/highlights";
import { validateHighlightUrl } from "@/lib/highlight-url";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const MAX_COMPANY_NAME_LEN = 80;

interface Body {
  submissionId?: number;
  amount?: number;
  url?: string;
  companyName?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submissionId = Number(body.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return Response.json({ error: "Invalid idea id." }, { status: 400 });
  }

  // Whole dollars, clamped to [MIN_BID, MAX_BID] — the same $999,999
  // ceiling enforced in lib/board-ui.ts (the stepper) and
  // app/highlight/[id]/page.tsx (server-side clamp on load). Dodo's
  // product itself has no configured maximum, so this check is the
  // only thing standing between a malformed request and an
  // arbitrarily large charge attempt.
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < MIN_BID || amount > MAX_BID) {
    return Response.json(
      { error: `Amount must be a whole number between $${MIN_BID} and $${MAX_BID.toLocaleString()}.` },
      { status: 400 }
    );
  }

  let url: string | null = null;
  if (typeof body.url === "string" && body.url.trim().length > 0) {
    const result = await validateHighlightUrl(body.url);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    url = result.normalized!;
  }

  let companyName: string | null = null;
  if (typeof body.companyName === "string" && body.companyName.trim().length > 0) {
    companyName = body.companyName.trim().slice(0, MAX_COMPANY_NAME_LEN);
  }

  const submissionRows = await query<{ id: number; idea_text: string }>(
    `SELECT id, idea_text FROM submissions WHERE id = $1`,
    [submissionId]
  );
  const submission = submissionRows[0];
  if (!submission) {
    return Response.json({ error: "Idea not found." }, { status: 404 });
  }

  const amountCents = amount * 100;

  const highlightId = await createPendingHighlight({
    submissionId,
    amountCents,
    url,
    companyName,
  });

  try {
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: DODO_PRODUCT_ID!,
          quantity: 1,
          // Pay-what-you-want amount, in cents, at checkout-creation
          // time — never trust a client-supplied amount past this
          // point; this is the number Dodo actually charges.
          amount: amountCents,
        },
      ],
      metadata: {
        highlightId: String(highlightId),
        submissionId: String(submissionId),
      },
      return_url: `${SITE_URL}/highlight/${submissionId}/done?highlightId=${highlightId}`,
      cancel_url: `${SITE_URL}/highlight/${submissionId}?amount=${amount}`,
    });

    await attachCheckoutSession(highlightId, session.session_id);

    if (!session.checkout_url) {
      await markHighlightFailed(highlightId, "Dodo checkout session had no checkout_url");
      return Response.json({ error: "Could not start checkout." }, { status: 502 });
    }

    return Response.json({ checkoutUrl: session.checkout_url, highlightId });
  } catch (err) {
    console.error(`[highlight checkout] Dodo session creation failed for highlight ${highlightId}`, err);
    await markHighlightFailed(
      highlightId,
      `Dodo checkout session creation threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return Response.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
