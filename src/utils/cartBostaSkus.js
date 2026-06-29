import { getBostaSkusByProduct } from "../api/ordersApi";
import { appendVariantFieldsToCartLine, resolveCatalogProductApiId } from "./cartProductVariants";

function parseBostaSkuOption(entry, context = {}) {
  const skuCode = String(entry?.skuCode ?? entry?.sku ?? "").trim();
  if (!skuCode) return null;
  const availableQuantity = Number(entry?.availableQuantity ?? entry?.quantity ?? 0) || 0;
  const inStock = entry?.inStock !== false && availableQuantity > 0;
  const name = String(entry?.name ?? skuCode).trim();
  const optName = String(context.optName ?? "").trim();
  const stockHint = inStock ? ` (${availableQuantity})` : " (نفد)";
  const prefix = optName && optName !== name ? `${optName} · ` : "";
  const entityId = String(context.entityId ?? "").trim();
  const size = String(context.size ?? entry?.size ?? "").trim();

  return {
    id: skuCode,
    skuCode,
    name,
    availableQuantity,
    inStock,
    label: `${prefix}${name}${stockHint}`,
    skuData: {
      skuCode,
      name,
      availableQuantity,
      inStock,
      ...(entityId ? { entityId } : {}),
      ...(size ? { size } : {}),
      ...(context.mappingType ? { mappingType: context.mappingType } : {}),
      ...(optName ? { optionName: optName } : {}),
    },
  };
}

function collectSkusFromMappingOptions(mappingOptions) {
  const skuOptions = [];
  let recommendedSku = "";

  for (const opt of mappingOptions) {
    if (!opt || typeof opt !== "object") continue;

    const optRecommended = String(opt.recommendedSku ?? "").trim();
    if (!recommendedSku && optRecommended) recommendedSku = optRecommended;

    const skus = Array.isArray(opt.skus) ? opt.skus : [];
    const context = {
      optName: String(opt.label ?? opt.name ?? "").trim(),
      entityId: String(opt.entityId ?? opt.productId ?? "").trim(),
      size: String(opt.size ?? "").trim(),
      mappingType: String(opt.mappingType ?? "").trim(),
    };

    for (const sku of skus) {
      const parsed = parseBostaSkuOption(sku, context);
      if (parsed) skuOptions.push(parsed);
    }
  }

  return { skuOptions, recommendedSku };
}

export function parseBostaSkusResponse(response) {
  const root = response?.data ?? response;
  const payload =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? root.data
      : root;

  if (!payload || typeof payload !== "object") {
    return { productLabel: "", skuOptions: [], recommendedSku: "" };
  }

  const productLabel = String(
    payload.productName ?? payload.label ?? payload.name ?? "",
  ).trim();

  const mappingOptions = Array.isArray(payload.options) ? payload.options : [];
  let skuOptions = [];
  let recommendedSku = String(payload.recommendedSku ?? "").trim();

  if (mappingOptions.length > 0) {
    const collected = collectSkusFromMappingOptions(mappingOptions);
    skuOptions = collected.skuOptions;
    if (!recommendedSku) recommendedSku = collected.recommendedSku;
  } else if (Array.isArray(payload.skus)) {
    skuOptions = payload.skus.map((sku) => parseBostaSkuOption(sku)).filter(Boolean);
  }

  const deduped = new Map();
  for (const opt of skuOptions) {
    if (!deduped.has(opt.skuCode)) deduped.set(opt.skuCode, opt);
  }
  skuOptions = Array.from(deduped.values());

  if (!recommendedSku) {
    const inStock = skuOptions.find((o) => o.inStock);
    if (inStock) recommendedSku = inStock.skuCode;
  }

  return { productLabel, skuOptions, recommendedSku };
}

export async function fetchBostaSkuOptions(productId) {
  const id = String(productId ?? "").trim();
  if (!id) return { productLabel: "", skuOptions: [], recommendedSku: "" };
  try {
    const response = await getBostaSkusByProduct(id);
    return parseBostaSkusResponse(response);
  } catch (error) {
    console.log(error);
    return { productLabel: "", skuOptions: [], recommendedSku: "" };
  }
}

export function applyBostaSkuSelection(options, skuCode) {
  const code = String(skuCode ?? "").trim();
  const hit = (options ?? []).find((o) => o.skuCode === code);
  if (!hit) return {};

  return {
    selectedBostaSkuCode: hit.skuCode,
    selectedBostaSkuData: hit.skuData,
  };
}

export function clearCartRowBostaSkuFields() {
  return {
    bostaSkuOptions: [],
    bostaProductLabel: "",
    selectedBostaSkuCode: "",
    selectedBostaSkuData: null,
    bostaSkusLoading: false,
    bostaRecommendedSku: "",
  };
}

export async function loadBostaSkusForCatalogProduct(product) {
  const productId = resolveCatalogProductApiId(product);
  if (!productId) {
    return {
      bostaSkuOptions: [],
      bostaProductLabel: "",
      bostaRecommendedSku: "",
    };
  }
  const { productLabel, skuOptions, recommendedSku } =
    await fetchBostaSkuOptions(productId);
  return {
    bostaSkuOptions: skuOptions,
    bostaProductLabel: productLabel,
    bostaRecommendedSku: recommendedSku,
  };
}

export async function enrichCartRowWithBostaSkus(row, { preselectedSkuCode } = {}) {
  const productId =
    row?.catalogProductKey ||
    (row?.catalogProductId != null ? String(row.catalogProductId) : "");
  if (!productId) return row;

  const { productLabel, skuOptions, recommendedSku } =
    await fetchBostaSkuOptions(productId);
  if (skuOptions.length === 0) return row;

  const preferred =
    String(preselectedSkuCode ?? row?.selectedBostaSkuCode ?? "").trim() ||
    recommendedSku;

  const base = {
    ...row,
    bostaSkuOptions: skuOptions,
    bostaProductLabel: productLabel || row.name,
    bostaRecommendedSku: recommendedSku,
    bostaSkusLoading: false,
  };

  if (preferred) {
    return { ...base, ...applyBostaSkuSelection(skuOptions, preferred) };
  }

  if (skuOptions.length === 1) {
    return { ...base, ...applyBostaSkuSelection(skuOptions, skuOptions[0].skuCode) };
  }

  return base;
}

export function appendBostaSkuFieldsToCartLine(line, row, productId) {
  const skuCode = String(row?.selectedBostaSkuCode ?? "").trim();
  if (!skuCode) return line;

  const skuData = row?.selectedBostaSkuData;
  const skuName = String(skuData?.name ?? skuCode).trim();
  const variantId = String(row?.selectedVariantId ?? row?.productVariantId ?? "").trim();
  const size = String(
    skuData?.size ?? row?.variationProp ?? "",
  ).trim();
  const label = String(
    row?.bostaProductLabel ?? row?.name ?? line?.product?.name ?? "",
  ).trim();

  line.bosta_sku = skuCode;
  line.bosta_name = skuName;
  line.variant = {
    ...(variantId || skuData?.entityId
      ? { id: variantId || skuData.entityId }
      : {}),
    ...(size ? { size } : {}),
    sku: skuCode,
    name: skuName,
    ...(label ? { label } : {}),
  };

  return line;
}

export function finalizeCartLine(line, row, productId) {
  const skuCode = String(row?.selectedBostaSkuCode ?? "").trim();
  if (skuCode) return appendBostaSkuFieldsToCartLine(line, row, productId);
  return appendVariantFieldsToCartLine(line, row, productId);
}

export function validateCartRowsBostaSkus(cartItems) {
  const errors = [];
  for (const row of cartItems ?? []) {
    const hasProduct =
      String(row?.name ?? "").trim() !== "" || String(row?.sku ?? "").trim() !== "";
    if (!hasProduct) continue;
    if (
      Array.isArray(row?.bostaSkuOptions) &&
      row.bostaSkuOptions.length > 0 &&
      !String(row?.selectedBostaSkuCode ?? "").trim()
    ) {
      errors.push(`اختاري SKU بوسطة للمنتج: ${row.name || row.sku || "—"}`);
    }
  }
  return errors;
}

/** SKU to pass to send-to-bosta when the order has product line(s). */
export function resolveBostaSkuForSend(cartItems) {
  const rows = (cartItems ?? []).filter(
    (row) =>
      String(row?.name ?? "").trim() !== "" || String(row?.sku ?? "").trim() !== "",
  );
  const codes = rows
    .map((row) => String(row?.selectedBostaSkuCode ?? "").trim())
    .filter(Boolean);
  const needsSelection = rows.some(
    (row) =>
      Array.isArray(row?.bostaSkuOptions) && row.bostaSkuOptions.length > 0,
  );

  if (needsSelection && codes.length === 0) {
    return { bostaSku: "", error: "اختاري SKU بوسطة قبل الإرسال إلى بوسطة" };
  }

  if (codes.length === 0) return { bostaSku: "" };

  const unique = [...new Set(codes)];
  if (unique.length > 1) {
    return {
      bostaSku: "",
      error:
        "الطلب يحتوي أكثر من SKU بوسطة مختلف — اختاري SKU واحد أو احفظي طلباً بمنتج واحد",
    };
  }

  return { bostaSku: unique[0] };
}
