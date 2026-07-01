import { getProductById } from "../api/ordersApi";
import {
  parseProductRawData,
  productToCartFields,
} from "../pages/orders/cartCatalogHelpers";

export function resolveCatalogProductApiId(product) {
  const fields = productToCartFields(product);
  return (
    fields.catalogProductKey ||
    (fields.catalogProductId != null ? String(fields.catalogProductId) : "")
  ).trim();
}

function parseVariantOption(variant) {
  const props = Array.isArray(variant?.variation_props)
    ? variant.variation_props
    : [];
  const variationLabel = String(props[0]?.variation ?? "اختر المقاس").trim();
  const label =
    props
      .map((p) => String(p?.variation_prop ?? "").trim())
      .filter(Boolean)
      .join(" · ") || String(variant?.id ?? "");
  const id = String(variant?.id ?? "").trim();

  return {
    id,
    price: Number(variant?.sale_price ?? variant?.price ?? 0) || 0,
    variationLabel,
    label,
    variationProps: props,
    variantData: {
      id,
      price: Number(variant?.price ?? 0) || 0,
      product_id: String(variant?.product_id ?? "").trim(),
      quantity: Number(variant?.quantity ?? 0) || 0,
      sale_price: Number(variant?.sale_price ?? variant?.price ?? 0) || 0,
      taager_code: String(variant?.taager_code ?? ""),
      variation_props: props,
    },
  };
}

export function parseProductVariantsResponse(response) {
  const data = response?.data ?? response?.product ?? response;
  const variants = Array.isArray(data?.variants) ? data.variants : [];
  return variants.map(parseVariantOption).filter((v) => v.id);
}

export async function fetchProductVariantOptions(productId) {
  const id = String(productId ?? "").trim();
  if (!id) return [];
  const response = await getProductById(id);
  return parseProductVariantsResponse(response);
}

export function applyVariantSelection(
  options,
  variantId,
  { preservePrice = false, linePrice } = {},
) {
  const id = String(variantId ?? "").trim();
  const hit = (options ?? []).find((o) => o.id === id);
  if (!hit) return {};

  const keptPrice = Number(linePrice ?? 0) || 0;
  const variantData =
    preservePrice && keptPrice > 0 && hit.variantData
      ? { ...hit.variantData, price: keptPrice, sale_price: keptPrice }
      : hit.variantData;

  return {
    selectedVariantId: hit.id,
    productVariantId: hit.id,
    variationProp: hit.label,
    variationProps: hit.variationProps,
    selectedVariantData: variantData,
    ...(preservePrice ? {} : { price: hit.price > 0 ? hit.price : "" }),
  };
}

export function findVariantIdByVariationProp(options, variationProp) {
  const target = String(variationProp ?? "").trim();
  if (!target) return "";
  const hit = (options ?? []).find((o) => o.label === target);
  return hit?.id ?? "";
}

export function clearCartRowVariantFields() {
  return {
    variantOptions: [],
    selectedVariantId: "",
    productVariantId: "",
    variationProp: "",
    variationProps: null,
    selectedVariantData: null,
    variationLabel: "",
    variantsLoading: false,
  };
}

export async function enrichCartRowWithVariants(row, { preselectedVariantId } = {}) {
  const productId =
    row?.catalogProductKey ||
    (row?.catalogProductId != null ? String(row.catalogProductId) : "");
  if (!productId) return row;

  try {
    const options = await fetchProductVariantOptions(productId);
    if (options.length === 0) return row;

    const variationLabel = options[0]?.variationLabel ?? "اختر المقاس";
    const preferredId =
      String(preselectedVariantId ?? row?.selectedVariantId ?? row?.productVariantId ?? "").trim() ||
      findVariantIdByVariationProp(options, row?.variationProp);
    const preservePrice = Number(row?.price) > 0;

    if (preferredId) {
      return {
        ...row,
        variantOptions: options,
        variationLabel,
        ...applyVariantSelection(options, preferredId, {
          preservePrice,
          linePrice: row.price,
        }),
        variantsLoading: false,
      };
    }

    if (options.length === 1) {
      return {
        ...row,
        variantOptions: options,
        variationLabel,
        ...applyVariantSelection(options, options[0].id, {
          preservePrice,
          linePrice: row.price,
        }),
        variantsLoading: false,
      };
    }

    return {
      ...row,
      variantOptions: options,
      variationLabel,
      variantsLoading: false,
    };
  } catch (error) {
    console.log(error);
    return { ...row, variantsLoading: false };
  }
}

export async function loadVariantsForCatalogProduct(product) {
  const productId = resolveCatalogProductApiId(product);
  if (!productId) {
    return { variantOptions: [], variationLabel: "" };
  }

  const options = await fetchProductVariantOptions(productId);
  return {
    variantOptions: options,
    variationLabel: options[0]?.variationLabel ?? "اختر المقاس",
  };
}

export function buildCartItemVariantObject(row, productId) {
  const variantId = String(row?.selectedVariantId ?? row?.productVariantId ?? "").trim();
  if (!variantId) return null;

  const stored = row?.selectedVariantData;
  if (stored && typeof stored === "object") {
    const pid = String(stored.product_id ?? productId ?? "").trim();
    return {
      id: String(stored.id ?? variantId).trim(),
      price: Number(stored.price) || Number(row.price) || 0,
      product_id: pid || undefined,
      quantity: Number(stored.quantity) || 0,
      sale_price: Number(stored.sale_price) || Number(row.price) || 0,
      taager_code: String(stored.taager_code ?? ""),
      variation_props: Array.isArray(stored.variation_props)
        ? stored.variation_props
        : Array.isArray(row.variationProps)
          ? row.variationProps
          : [],
    };
  }

  const props = Array.isArray(row?.variationProps) ? row.variationProps : [];
  const pid = String(productId ?? "").trim();

  return {
    id: variantId,
    price: Number(row.price) || 0,
    ...(pid ? { product_id: pid } : {}),
    quantity: 0,
    sale_price: Number(row.price) || 0,
    taager_code: "",
    variation_props: props,
  };
}

export function appendVariantFieldsToCartLine(line, row, productId) {
  const pid =
    productId ??
    line.product_id ??
    row.catalogProductKey ??
    (row.catalogProductId != null ? String(row.catalogProductId) : null);
  const variant = buildCartItemVariantObject(row, pid);
  if (variant) {
    line.variant = variant;
  }
  return line;
}

export function validateCartRowsVariants(cartItems) {
  const errors = [];
  for (const row of cartItems ?? []) {
    const hasProduct =
      String(row?.name ?? "").trim() !== "" || String(row?.sku ?? "").trim() !== "";
    if (!hasProduct) continue;
    if (
      Array.isArray(row?.variantOptions) &&
      row.variantOptions.length > 0 &&
      !String(row?.selectedVariantId ?? "").trim()
    ) {
      errors.push(`اختاري المقاس للمنتج: ${row.name || row.sku || "—"}`);
    }
  }
  return errors;
}
