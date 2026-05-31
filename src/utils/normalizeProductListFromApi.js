/**
 * Unwraps nested API envelopes until an array of product rows is found.
 * Supports shapes like { data: [...] }, { data: { data: [...] } }, etc.
 */
export function normalizeProductListFromApi(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;

  const arrayKeys = ["products", "items", "results", "records"];
  for (const k of arrayKeys) {
    const v = payload[k];
    if (Array.isArray(v)) return v;
  }
  if (Array.isArray(payload.data)) return payload.data;

  let cur = payload;
  const seen = new Set();
  for (let depth = 0; depth < 12; depth++) {
    if (!cur || typeof cur !== "object") break;
    if (seen.has(cur)) break;
    seen.add(cur);

    for (const k of arrayKeys) {
      const v = cur[k];
      if (Array.isArray(v)) return v;
    }
    if (Array.isArray(cur.data)) return cur.data;
    const inner = cur.data;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      cur = inner;
      continue;
    }
    break;
  }
  return [];
}
