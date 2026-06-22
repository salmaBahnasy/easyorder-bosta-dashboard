/**
 * Normalizes Arabic/Latin text for client-side search (diacritics, alef/ya variants).
 */
export function normalizeArabicSearchText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if every whitespace-separated token appears in haystack.
 */
export function arabicSearchMatches(haystackSource, query) {
  const haystack = normalizeArabicSearchText(haystackSource);
  const tokens = normalizeArabicSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}
