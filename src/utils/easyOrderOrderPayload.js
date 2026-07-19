/**
 * Payload shape aligned with EasyOrder store orders (government, orderSource, total_cost, …).
 */

export function normalizeEasyOrderPaymentMethod(value) {
  const raw = String(value ?? "cod").trim();
  if (!raw) return "cod";
  const lower = raw.toLowerCase();
  if (lower === "cod" || lower === "cash on delivery") return "cod";
  if (lower === "instapay" || lower === "insta pay" || lower.includes("instapay")) {
    return "instapay";
  }
  return lower;
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cod", label: "COD (دفع عند الاستلام)" },
  { value: "instapay", label: "إنستاباي" },
];

export function paymentMethodOptionLabel(value) {
  const normalized = normalizeEasyOrderPaymentMethod(value);
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === normalized)?.label ??
    normalized
  );
}

export function resolveEasyOrderPaymentMethod(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = normalizeEasyOrderPaymentMethod(raw);
  return PAYMENT_METHOD_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : null;
}

export function getPaymentMethodValidationError(value) {
  if (!String(value ?? "").trim()) return "طريقة الدفع مطلوبة";
  if (!resolveEasyOrderPaymentMethod(value)) {
    return "اختر طريقة دفع صحيحة (cod أو instapay)";
  }
  return null;
}

export function mapEasyOrderStatusFields(backendStatus) {
  const orderStatus = String(backendStatus ?? "new").trim() || "new";
  const status = orderStatus === "new" ? "pending" : orderStatus;
  return { orderStatus, order_status: orderStatus, status };
}

import { buildCartItemVariantObject } from "./cartProductVariants";
import { appendBostaSkuFieldsToCartLine } from "./cartBostaSkus";
import { appendBostaLocationIdsToPayload } from "./bostaLocation";

export function buildEasyOrderCartItems(linesForPayload) {
  return (linesForPayload ?? []).map((row) => {
    const quantity = Number(row.quantity) || 1;
    const price = Number(row.price) || 0;
    const productId =
      row.catalogProductId != null
        ? String(row.catalogProductId)
        : row.catalogProductKey ||
          (row.resolvedProductId != null ? String(row.resolvedProductId) : "");

    const item = {
      quantity,
      price,
      in_cart: false,
      product: {
        name: String(row.name ?? "").trim() || "منتج",
        sku: String(row.sku ?? "").trim() || "SKU-001",
      },
    };

    if (productId) {
      item.product_id = productId;
      item.product.id = productId;
    }

    const bostaSku = String(row?.selectedBostaSkuCode ?? "").trim();
    if (bostaSku) {
      appendBostaSkuFieldsToCartLine(item, row, productId || null);
    } else {
      const variant = buildCartItemVariantObject(row, productId || null);
      if (variant) item.variant = variant;
    }

    return item;
  });
}

/**
 * @param {object} input
 * @returns {object} Body for POST /orders (before audit fields merge in ordersApi).
 */
export function buildEasyOrderCreatePayload({
  id,
  fullName,
  phone,
  phone2,
  address,
  government,
  cityId,
  districtId,
  orderSource,
  orderType,
  backendStatus,
  shippingStatus,
  paymentMethod,
  shippingCost,
  itemsSubtotal,
  totalCost,
  cartItems,
  note,
  createdAt,
}) {
  const { orderStatus, order_status, status } =
    mapEasyOrderStatusFields(backendStatus);
  const payment_method = resolveEasyOrderPaymentMethod(paymentMethod);
  if (!payment_method) {
    throw new Error("payment_method is required");
  }
  const shipping_cost = Number(shippingCost) || 0;
  const cost = Number(itemsSubtotal) || 0;
  const total_cost = Number(totalCost) || cost + shipping_cost;
  const created_at = createdAt ?? new Date().toISOString();

  const payload = {
    id,
    full_name: String(fullName ?? "").trim() || "Customer",
    phone: String(phone ?? "").trim(),
    phone2: String(phone2 ?? "").trim(),
    address: String(address ?? "").trim(),
    government: String(government ?? "").trim(),
    order_source: orderSource,
    orderSource: orderSource,
    order_type: orderType,
    orderType: orderType,
    order_status,
    orderStatus,
    status,
    payment_method,
    // طلبات الداشبورد اليدوية — EasyConfirm ثابت confirmed
    customerStatus: "confirmed",
    customer_status: "confirmed",
    is_manual: true,
    isManual: true,
    shipping_cost,
    expense: shipping_cost,
    cost,
    total_cost,
    cart_items: cartItems,
    created_at,
    created_day: created_at,
  };

  const trimmedNote = String(note ?? "").trim();
  if (trimmedNote) payload.note = trimmedNote;

  if (shippingStatus) {
    payload.shipping_status = shippingStatus;
    payload.shippingStatus = shippingStatus;
  }

  appendBostaLocationIdsToPayload(payload, { cityId, districtId });

  return payload;
}
