import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Refund Policy · RateMyIdea",
  description:
    "Highlight Board placements are non-refundable. This page explains why, and the narrow cases where a refund is issued.",
};

export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refund Policy"
      updated="27 August 2026"
      lede="Highlight Board placements are non-refundable. This page explains exactly what that means, why it works that way, and the narrow set of cases where money is returned."
    >
      <section className="legal-section">
        <h2>
          <b>01</b>The free service
        </h2>
        <p>
          Submitting an idea, receiving a score, and appearing on the Merit
          Board are all free. No payment is taken, so there is nothing to
          refund.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>02</b>Highlight Board placements are final
        </h2>
        <p>
          Every payment for a Highlight Board placement is final and
          non-refundable.
        </p>
        <div className="legal-note">
          <p>
            A placement is delivered in full the moment your payment
            completes. Your idea appears at its paid position immediately,
            publicly, and permanently in the record of the board.
          </p>
          <p>
            There is nothing left to deliver afterwards, and nothing that
            can be returned or withdrawn once other people have seen it.
          </p>
        </div>
        <p>
          This is stated at checkout before payment, in plain language, and
          you confirm it as part of buying.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>03</b>Things that are not grounds for a refund
        </h2>
        <p>
          To be completely clear before you pay, none of the following will
          be refunded:
        </p>
        <ul>
          <li>
            Being outbid and moving down the board, whether that happens in
            a month or in ten minutes
          </li>
          <li>Receiving fewer visitors or clicks than you hoped for</li>
          <li>Deciding afterwards that you paid more than you meant to</li>
          <li>Changing your mind about being publicly listed</li>
          <li>Asking for your own placement to be removed</li>
          <li>
            Disagreeing with the score or the written assessment your idea
            received
          </li>
          <li>The site later changing, resetting the boards, or shutting down</li>
        </ul>
        <p>
          The Highlight Board is a public auction for position. Getting
          outbid is the mechanic working as designed, not a fault.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>04</b>When a refund is issued
        </h2>
        <p>A full refund is given in these cases, without argument:</p>
        <ul>
          <li>
            <b>Duplicate charge.</b> You were billed more than once for the
            same placement.
          </li>
          <li>
            <b>Failed delivery.</b> Payment completed but the placement
            never appeared, and it could not be fixed within 48 hours of
            you reporting it.
          </li>
          <li>
            <b>Wrong amount.</b> You were charged an amount different from
            the one shown at checkout.
          </li>
          <li>
            <b>Unauthorised payment.</b> Your card was used without your
            permission, once verified with the payment provider.
          </li>
          <li>
            <b>Removal in error.</b> A valid placement was taken down by
            mistake and could not be restored.
          </li>
        </ul>
        <p>
          If a placement is removed because it broke the rules in the{" "}
          <a href="/terms">terms of service</a>, no refund is given.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>05</b>How to request one
        </h2>
        <p>
          Email <a href="mailto:support@ratemyidea.fun">support@ratemyidea.fun</a>{" "}
          within 14 days of the charge. Include:
        </p>
        <ul>
          <li>The email address used at checkout</li>
          <li>The Dodo Payments order or transaction reference from your receipt</li>
          <li>The date and amount of the charge</li>
          <li>A short description of what went wrong</li>
        </ul>
        <p>
          Every request gets a reply within two working days. Approved
          refunds are processed through Dodo Payments and usually reach
          your account within 5 to 10 working days, depending on your bank.
        </p>
        <p>Refunds are issued to the original payment method only.</p>
      </section>

      <section className="legal-section">
        <h2>
          <b>06</b>Before you raise a chargeback
        </h2>
        <p>
          If something has gone wrong, email first. Genuine problems in the
          list above are refunded quickly and without dispute, and a direct
          email is far faster than a bank claim.
        </p>
        <p>
          Chargebacks raised for reasons already listed as non-refundable
          will be contested with the payment provider, using the checkout
          record showing the terms you accepted.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>07</b>Who processes payments
        </h2>
        <p>
          Payments and refunds are handled by Dodo Payments, acting as
          merchant of record. They appear on your statement as the merchant
          and issue your receipt. Card details are never received or stored
          by this site.
        </p>
      </section>
    </LegalLayout>
  );
}
