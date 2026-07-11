import { getProductById } from "../api/ordersApi";
import { parseProductRawData } from "../pages/orders/cartCatalogHelpers";

/** Effective selling price: sale_price when set, otherwise price. */
export function resolveEffectiveCatalogPrice(source) {
  if (source == null) return 0;

  let p = source;
  if (typeof source === "number" || typeof source === "string") {
    const n = Number(source);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (typeof source !== "object") return 0;

  p = source.data ?? source.product ?? source.item ?? source;
  if (Array.isArray(p)) return 0;

  const rd = parseProductRawData(p);
  const sale = Number(p.sale_price ?? rd.sale_price ?? 0);
  const regular = Number(p.price ?? rd.price ?? 0);

  if (Number.isFinite(sale) && sale > 0) return sale;
  if (Number.isFinite(regular) && regular > 0) return regular;
  return 0;
}

export function formatCatalogPriceValue(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 100) / 100);
}

export async function fetchLiveCatalogPrice(productId, { variantId } = {}) {
  const id = String(productId ?? "").trim();
  if (!id) return 0;

  const response = await getProductById(id);
  const data = response?.data ?? response?.product ?? response;

  const variantKey = String(variantId ?? "").trim();
  if (variantKey) {
    const variants = Array.isArray(data?.variants) ? data.variants : [];
    const hit = variants.find((v) => String(v?.id ?? "") === variantKey);
    if (hit) return resolveEffectiveCatalogPrice(hit);
  }

  return resolveEffectiveCatalogPrice(data);
}

export function computeCartLinesSubtotal(rows) {
  return (rows ?? []).reduce((sum, row) => {
    const q = Number(row?.quantity) || 0;
    const p = Number(row?.price) || 0;
    return sum + q * p;
  }, 0);
}

export function computeCartPayloadSubtotal(lines) {
  return (lines ?? []).reduce((sum, line) => {
    const q = Number(line?.quantity) || 1;
    const p = Number(line?.price) || 0;
    return sum + q * p;
  }, 0);
}

export async function resolveCartRowSystemPrice(row) {
  const productId =
    row?.catalogProductKey ||
    (row?.catalogProductId != null ? String(row.catalogProductId) : "");
  if (!productId) {
    return Number(row?.price) || 0;
  }

  const variantId = String(row?.selectedVariantId ?? row?.productVariantId ?? "").trim();
  try {
    const live = await fetchLiveCatalogPrice(productId, { variantId });
    if (live > 0) return live;
  } catch (error) {
    console.log(error);
  }

  const variantPrice = resolveEffectiveCatalogPrice(row?.selectedVariantData);
  if (variantPrice > 0) return variantPrice;

  const rowPrice = Number(row?.price) || 0;
  return rowPrice > 0 ? rowPrice : 0;
}

/** Refresh cart rows with live EasyOrders prices (for order create/send). */
export async function syncCartItemsWithSystemPrices(cartItems) {
  const rows = Array.isArray(cartItems) ? cartItems : [];
  return Promise.all(
    rows.map(async (row) => {
      const hasProduct =
        String(row?.name ?? "").trim() !== "" || String(row?.sku ?? "").trim() !== "";
      if (!hasProduct) return row;
      const price = await resolveCartRowSystemPrice(row);
      return price > 0 ? { ...row, price } : row;
    }),
  );
}
