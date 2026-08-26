// Enforces terms.html §07's rules on the optional website URL a
// Highlight Board purchase can attach: "Link shorteners, affiliate
// parameters, redirect chains or invite links" are disallowed, and
// payments are only ever collected over https. This can't *prove* a
// URL is safe — that needs real human abuse review — but it catches
// the mechanical cases the terms page names explicitly, server-side,
// so a hand-crafted request can't skip whatever the form validates.

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "tiny.cc",
  "rb.gy",
  "s.id",
  "trib.al",
  "bl.ink",
  "shorte.st",
  "adf.ly",
  "clck.ru",
  "v.gd",
  "qlink.me",
  "1url.com",
  "chilp.it",
  "u.to",
  "tr.im",
  "lnk.bio",
  "lnk.to",
  "shrtco.de",
]);

// Common invite-link hosts/paths — group chat and server invites, which
// terms.html names alongside shorteners/affiliate links/redirect chains.
const INVITE_LINK_PATTERNS: RegExp[] = [
  /^discord\.gg$/i,
  /^(www\.)?discord\.com$/i, // combined with a /invite/ path check below
  /^(www\.)?chat\.whatsapp\.com$/i,
  /^t\.me$/i, // t.me/joinchat/... or t.me/+...
  /^(www\.)?slack\.com$/i, // combined with a /join or /invite path check
];

// Common affiliate/tracking query parameters, matched by key name.
const AFFILIATE_PARAM_RE =
  /^(tag|ref|refid|ref_id|affiliate|aff|aff_id|affid|partner|partner_id|pid|clickid|click_id|irclickid|fbclid|gclid|utm_[a-z]+)$/i;

export interface UrlValidationResult {
  ok: boolean;
  error?: string;
  normalized?: string;
}

export async function validateHighlightUrl(
  raw: string
): Promise<UrlValidationResult> {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "The URL must start with https://." };
  }

  const host = url.hostname.toLowerCase();

  if (SHORTENER_HOSTS.has(host)) {
    return {
      ok: false,
      error: "Link shorteners aren't allowed — link to the real destination.",
    };
  }

  const path = url.pathname.toLowerCase();
  const isInviteLink =
    INVITE_LINK_PATTERNS.some((re) => re.test(host)) &&
    (host.includes("discord.gg") ||
      host.includes("chat.whatsapp.com") ||
      host === "t.me" ||
      path.includes("/invite/") ||
      path.startsWith("/joinchat") ||
      path.startsWith("/join"));
  if (isInviteLink) {
    return { ok: false, error: "Invite links aren't allowed." };
  }

  for (const key of url.searchParams.keys()) {
    if (AFFILIATE_PARAM_RE.test(key)) {
      return {
        ok: false,
        error: `Remove the "${key}" tracking/affiliate parameter from the URL.`,
      };
    }
  }

  // Best-effort redirect-chain check: if the URL itself answers with a
  // 3xx, it's acting as a redirector, which terms.html also disallows.
  // A target that's merely slow, offline, or rejects HEAD requests is
  // NOT penalized here — this is advisory, not a full crawl, and a
  // paying customer shouldn't be blocked by a third-party site's
  // hiccup.
  try {
    const res = await fetch(url.toString(), {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        ok: false,
        error: "That URL redirects elsewhere — link directly to the final page.",
      };
    }
  } catch {
    // Network error, timeout, or HEAD unsupported — don't block on it.
  }

  return { ok: true, normalized: url.toString() };
}
