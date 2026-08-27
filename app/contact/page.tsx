import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Contact · RateMyIdea",
  description:
    "How to reach RateMyIdea, including support, payment questions and takedown requests.",
};

export default function ContactPage() {
  return (
    <LegalLayout
      title="Contact"
      updated="27 August 2026"
      lede="One person reads every message. There is no ticket system and no support queue, which means replies are slower than a company but they are actually from someone who can fix the problem."
    >
      <section className="legal-section">
        <h2>
          <b>01</b>Email
        </h2>
        <div className="legal-note">
          <p>
            <a href="mailto:support@ratemyidea.fun">support@ratemyidea.fun</a>
          </p>
          <p>
            Replies within two working days. Payment problems and takedown
            requests are handled first.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <h2>
          <b>02</b>Who operates the site
        </h2>
        <p>
          Ansh Jaisinghani
          <br />
          Sole proprietor
          <br />
          Andheri West
          <br />
          Mumbai, Maharashtra, India
        </p>
        <p>
          RateMyIdea is an independent side project run by one person. It is
          not a registered company.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>03</b>What to write in
        </h2>
        <ul>
          <li>
            <b>Take my idea down.</b> Send the link. No explanation needed,
            and no questions asked. Normally removed within two working
            days.
          </li>
          <li>
            <b>Something went wrong with a payment.</b> Include the Dodo
            Payments order reference from your receipt, the date and the
            amount. See the <a href="/refunds">refund policy</a> first.
          </li>
          <li>
            <b>A listing breaks the rules.</b> Send the link and say which
            rule. Listings breaching the <a href="/terms">terms</a> are
            removed without refund.
          </li>
          <li>
            <b>The score is wrong.</b> Worth reading first that scores are
            automated, blunt and often wrong by design. If something looks
            broken rather than harsh, do send it, because that is useful.
          </li>
          <li>
            <b>Press, or you want to write about this.</b> Happy to answer
            questions and share numbers.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>
          <b>04</b>Payment support
        </h2>
        <p>
          Payments are processed by Dodo Payments as merchant of record, and
          they appear as the merchant on your statement. For billing, tax or
          receipt questions you can contact them directly, or email here and
          it will be passed on.
        </p>
      </section>

      <section className="legal-section">
        <h2>
          <b>05</b>Elsewhere
        </h2>
        <p>
          Updates and launch notes are posted at{" "}
          <a href="https://x.com/yoursansh33" target="_blank" rel="noopener">
            @yoursansh33
          </a>{" "}
          on X. Direct messages there are open, though email gets a faster
          reply.
        </p>
      </section>
    </LegalLayout>
  );
}
