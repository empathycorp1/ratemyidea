// The same footer used on the homepage/result view (RateMyIdeaApp.tsx)
// — extracted here so the legal pages get an identical footer. No
// client state, so this is safe to render from a server component too.
export default function SiteFooter() {
  return (
    <footer>
      <div className="flinks">
        <a className="lead" href="/how-scoring-works">
          How scoring works?
        </a>
      </div>
      <div className="flinks">
        <a href="/terms">Terms</a>
        <a href="/refunds">Refunds</a>
        <a href="/contact">Contact</a>
      </div>
      <div className="byline">
        <span>
          ratemyidea.fun - a fun side project by{" "}
          <a href="https://x.com/yoursansh33">@yoursansh33</a>
        </span>
        <img src="/avatar.jpg" alt="Ansh Jaisinghani" />
      </div>
      <div className="built">
        <p>Built with</p>
        <div className="set">
          <a href="https://claude.ai" target="_blank" rel="noopener">
            Claude AI
          </a>
          <a
            href="https://claude.com/product/claude-code"
            target="_blank"
            rel="noopener"
          >
            Claude Code
          </a>
          <a href="https://vercel.com" target="_blank" rel="noopener">
            Vercel
          </a>
          <a href="https://dodopayments.com" target="_blank" rel="noopener">
            Dodo Payments
          </a>
        </div>
      </div>
    </footer>
  );
}
