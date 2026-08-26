import crypto from "node:crypto";

/**
 * Normalizes idea text before hashing, per scoring-spec.md:
 * lowercase, strip punctuation, collapse whitespace.
 * This is what makes caching work — two submissions that differ only
 * by capitalization or a stray comma must hash to the same value.
 */
export function normalizeIdea(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation, keep letters/numbers/spaces
    .replace(/\s+/g, " ")
    .trim();
}

/** SHA-256 hash of the normalized text, used as the cache key. */
export function hashIdea(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
