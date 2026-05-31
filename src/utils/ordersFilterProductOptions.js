/** Helpers shared by orders list & stats filters (product_id for API). */

export function normalizeProductList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.products)) return payload.products;
  if (payload.data?.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

export function getRawDataFields(item) {
  let rd = item?.raw_data;
  if (rd == null) return {};
  if (typeof rd === "string") {
    try {
      rd = JSON.parse(rd);
    } catch {
      return {};
    }
  }
  return rd && typeof rd === "object" && !Array.isArray(rd) ? rd : {};
}

/** معرّف يُرسل لـ product_id (يطابق البحث داخل raw_data في الـ API) */
export function getProductFilterId(item) {
  const rd = getRawDataFields(item);
  const candidates = [
    item?.id,
    item?._id,
    item?.product_id,
    item?.productId,
    rd.id,
    rd.product_id,
    rd.productId,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") return String(c).trim();
  }
  return "";
}

export function getProductListLabel(item) {
  const rd = getRawDataFields(item);
  const name = String(item?.name ?? item?.title ?? rd.name ?? rd.title ?? "منتج").trim();
  const sku = String(item?.sku ?? rd.sku ?? rd.SKU ?? "").trim();
  return { name: name || "منتج", sku };
}
