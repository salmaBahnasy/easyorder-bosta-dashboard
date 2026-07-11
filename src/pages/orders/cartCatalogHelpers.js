import {
  resolveEffectiveCatalogPrice,
} from "../../utils/catalogPrice";

export function parseProductRawData(product) {
  let rd = product?.raw_data;
  if (typeof rd === "string") {
    try {
      rd = JSON.parse(rd);
    } catch {
      rd = {};
    }
  }
  return rd && typeof rd === "object" && !Array.isArray(rd) ? rd : {};
}

/** Some APIs wrap the product in { product } / { item }. */
export function unwrapCatalogProduct(row) {
  if (!row || typeof row !== "object") return row;
  const inner = row.product ?? row.item ?? row.attributes;
  if (inner && typeof inner === "object") return inner;
  return row;
}

export function productOptionId(product, index) {
  const p = unwrapCatalogProduct(product);
  return String(
    p?.id ??
      p?._id ??
      p?.easyorder_id ??
      p?.product_id ??
      p?.uuid ??
      p?.sku ??
      `idx-${index}`,
  );
}

/** Stable string id for matching cart rows to catalog (includes easyorder_id). */
export function productCatalogKey(product) {
  const p = unwrapCatalogProduct(product);
  const k = String(
    p?.easyorder_id ?? p?.id ?? p?._id ?? p?.product_id ?? p?.uuid ?? "",
  ).trim();
  return k;
}

export function catalogProductDisplayName(product, index) {
  const p = unwrapCatalogProduct(product);
  const rd = parseProductRawData(p);
  const title = String(
    p?.name ??
      p?.title ??
      p?.product_name ??
      rd?.name ??
      rd?.title ??
      "",
  ).trim();
  if (title) return title;
  return productOptionId(product, index);
}

export function productToCartFields(product) {
  const p = unwrapCatalogProduct(product);
  const rd = parseProductRawData(p);
  const name = String(p?.name ?? p?.title ?? rd.name ?? rd.title ?? "");
  const sku = String(
    p?.sku ??
      p?.taager_code ??
      rd.sku ??
      p?.id ??
      p?._id ??
      p?.easyorder_id ??
      "",
  );
  const price = resolveEffectiveCatalogPrice(p);
  const rawId =
    p?.id ?? p?._id ?? p?.easyorder_id ?? rd.product_id ?? rd.id ?? p?.product_id;
  const rawStr = rawId != null && rawId !== "" ? String(rawId).trim() : "";
  const num = Number(rawStr);
  const isPureNumericId =
    rawStr !== "" && Number.isFinite(num) && num > 0 && String(num) === rawStr;
  const catalogProductId = isPureNumericId ? num : null;
  const catalogProductKey = rawStr && !isPureNumericId ? rawStr : "";
  return { sku, name, price, catalogProductId, catalogProductKey };
}

/** Cart rows that represent real order lines (non-empty product). */
export function filterCartLinesForPayload(cartItems) {
  return (cartItems ?? []).filter(
    (row) =>
      String(row?.name ?? "").trim() !== "" || String(row?.sku ?? "").trim() !== "",
  );
}

export function createEmptyCartRow() {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sku: "",
    name: "",
    variant: "",
    quantity: 1,
    price: "",
    catalogProductId: null,
    catalogProductKey: "",
    catalogOptionId: "",
    variantOptions: [],
    selectedVariantId: "",
    productVariantId: "",
    variationProp: "",
    variationProps: null,
    selectedVariantData: null,
    variationLabel: "",
    variantsLoading: false,
    bostaSkuOptions: [],
    bostaProductLabel: "",
    selectedBostaSkuCode: "",
    selectedBostaSkuData: null,
    bostaSkusLoading: false,
    bostaRecommendedSku: "",
  };
}

/** Stable value for <select> after picking a row from the catalog (ids are often strings, not numbers). */
export function cartRowSelectValue(row, catalogProducts) {
  const list = Array.isArray(catalogProducts) ? catalogProducts : [];
  const oid = String(row?.catalogOptionId ?? "").trim();
  if (oid && list.some((p, i) => productOptionId(p, i) === oid)) {
    return oid;
  }
  return catalogSelectValueForRow(row, catalogProducts);
}

/** Value for <select> when row was filled without catalogOptionId (e.g. loaded from API). */
export function catalogSelectValueForRow(row, catalogProducts) {
  const list = Array.isArray(catalogProducts) ? catalogProducts : [];

  const ckey = String(row.catalogProductKey ?? "").trim();
  if (ckey) {
    for (let idx = 0; idx < list.length; idx++) {
      const raw = list[idx];
      const p = unwrapCatalogProduct(raw);
      const pid = String(
        p?.easyorder_id ?? p?.id ?? p?._id ?? p?.product_id ?? "",
      ).trim();
      if (pid && pid === ckey) {
        return productOptionId(raw, idx);
      }
    }
  }

  if (row.catalogProductId != null) {
    for (let idx = 0; idx < list.length; idx++) {
      const raw = list[idx];
      const p = unwrapCatalogProduct(raw);
      const n = Number(p?.id ?? p?._id ?? parseProductRawData(p).id ?? 0);
      if (Number.isFinite(n) && n > 0 && n === row.catalogProductId) {
        return productOptionId(raw, idx);
      }
    }
  }

  const rowSku = String(row.sku ?? "").trim();
  if (rowSku) {
    for (let idx = 0; idx < list.length; idx++) {
      const raw = list[idx];
      const p = unwrapCatalogProduct(raw);
      const rd = parseProductRawData(p);
      const sku = String(p?.sku ?? p?.taager_code ?? rd.sku ?? "").trim();
      if (sku && sku === rowSku) {
        return productOptionId(raw, idx);
      }
    }
  }
  return "";
}
