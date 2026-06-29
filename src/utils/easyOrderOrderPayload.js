/**
 * Payload shape aligned with EasyOrder store orders (government, orderSource, total_cost, …).
 */

export function normalizeEasyOrderPaymentMethod(value) {
  const raw = String(value ?? "cod").trim();
  if (!raw) return "cod";
  if (raw.toLowerCase() === "cod") return "cod";
  if (raw.toLowerCase() === "instapay") return "instapay";
  return raw.toLowerCase();
}

export function mapEasyOrderStatusFields(backendStatus) {
  const orderStatus = String(backendStatus ?? "new").trim() || "new";
  const status = orderStatus === "new" ? "pending" : orderStatus;
  return { orderStatus, order_status: orderStatus, status };
}

import { buildCartItemVariantObject } from "./cartProductVariants";
import { appendBostaSkuFieldsToCartLine } from "./cartBostaSkus";

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
  const payment_method = normalizeEasyOrderPaymentMethod(paymentMethod);
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

  return payload;
}
