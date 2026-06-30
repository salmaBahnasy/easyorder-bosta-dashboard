export function orderRowKey(order, index = 0) {
  const k = order["Order ID"] ?? order.id ?? order.shortId ?? order.short_id;
  if (k != null && k !== "") return String(k);
  return `row-${index}`;
}

function toDisplayText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return (
      value
        .map((item) => toDisplayText(item, ""))
        .filter(Boolean)
        .join("، ") || fallback
    );
  }
  if (typeof value === "object") {
    const preferred =
      value.name ??
      value.title ??
      value.label ??
      value.sku ??
      value.code ??
      value.taager_code ??
      value.product_id;
    if (preferred != null && preferred !== "") return String(preferred);
    return fallback;
  }
  return fallback;
}

function extractVariationPropOnly(value) {
  if (value == null || value === "") return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const text = String(value).trim();
    return text || null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const prop = value.variation_prop;
    if (prop == null || prop === "") return null;
    return String(prop).trim() || null;
  }
  return null;
}

function parseMaybeJsonObject(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function collectItemVariantSources(item) {
  if (!item || typeof item !== "object") return [];
  const sources = [];
  const seen = new Set();

  function add(source) {
    if (!source || typeof source !== "object" || seen.has(source)) return;
    seen.add(source);
    sources.push(source);
  }

  add(item);
  add(item.product);
  add(parseMaybeJsonObject(item.raw_data));
  add(parseMaybeJsonObject(item.product?.raw_data));

  const variant = item.variant ?? item.product?.variant;
  if (typeof variant === "object" && variant !== null) {
    add(variant);
    add(parseMaybeJsonObject(variant.raw_data));
  }

  return sources;
}

function formatVariationPropsField(variationProps) {
  if (variationProps == null || variationProps === "") return null;
  if (
    typeof variationProps === "string" ||
    typeof variationProps === "number"
  ) {
    return extractVariationPropOnly(variationProps);
  }
  if (Array.isArray(variationProps)) {
    const parts = variationProps
      .map((entry) => extractVariationPropOnly(entry))
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }
  if (typeof variationProps === "object") {
    return extractVariationPropOnly(variationProps);
  }
  return null;
}

/** نص variation_prop للعرض (القيمة فقط، بدون variation). */
export function formatOrderItemVariationProp(item) {
  const parts = [];
  for (const src of collectItemVariantSources(item)) {
    const direct = extractVariationPropOnly(src.variation_prop);
    if (direct) parts.push(direct);

    const fromProps = formatVariationPropsField(src.variation_props);
    if (fromProps) parts.push(fromProps);
  }

  const unique = [...new Set(parts.filter(Boolean))];
  return unique.length ? unique.join(" · ") : null;
}

/** معرّف للعرض في الجدول */
export function orderDisplayId(order) {
  const v = order["Order ID"] ?? order.shortId ?? order.short_id ?? order.id;
  return v != null && v !== "" ? v : "—";
}

/** رقم مرجع الطلب (order_reference / orderReference). */
export function orderReference(order) {
  const ref = order?.order_reference ?? order?.orderReference;
  if (ref != null && String(ref).trim() !== "") return String(ref).trim();
  return null;
}

/** للجدول: المرجع إن وُجد وإلا المعرّف المعتاد. */
export function orderReferenceDisplay(order) {
  return orderReference(order) ?? orderDisplayId(order);
}

export function orderCustomer(order) {
  const c = order.customer;
  if (c && typeof c === "object" && c.fullName) {
    return c.fullName;
  }
  return order["ب"] ?? order.full_name ?? order.customerName ?? "—";
}

export function orderPhone(order) {
  const c = order.customer;
  if (c && typeof c === "object" && c.phone) {
    return c.phone;
  }
  return order["Phone"] ?? order.phone ?? "—";
}

/** رقم موبايل إضافي اختياري. */
export function orderSecondPhone(order) {
  const c = order.customer;
  if (c && typeof c === "object") {
    const fromCustomer =
      c.phone2 ?? c.second_phone ?? c.mobile2 ?? c.secondMobile;
    if (fromCustomer != null && String(fromCustomer).trim() !== "") {
      return String(fromCustomer).trim();
    }
  }
  const v =
    order.phone2 ??
    order.phone_2 ??
    order.second_phone ??
    order.secondPhone ??
    order.mobile2 ??
    order.second_mobile ??
    order.secondMobile;
  if (v != null && String(v).trim() !== "") return String(v).trim();
  return null;
}

export function orderCity(order) {
  const c = order.customer;
  if (c && typeof c === "object" && c.governorate) {
    return c.governorate;
  }
  return order["City"] ?? order.city ?? "—";
}

export function orderAddress(order) {
  const c = order.customer;
  if (c && typeof c === "object" && c.address) {
    return c.address;
  }
  return order["Address"] ?? order.address ?? "—";
}

export function orderProductBlock(order) {
  if (order["Product Name"]) {
    return {
      name: toDisplayText(order["Product Name"]),
      variant: toDisplayText(order["Product Variant"], ""),
    };
  }
  if (order.lineItemsSummary) {
    return { name: toDisplayText(order.lineItemsSummary), variant: "" };
  }
  const lineItems = order.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const first = lineItems[0];
    const name = toDisplayText(first.name ?? first.product ?? first, "—");
    const variant = toDisplayText(first.sku ?? first.variant ?? "", "");
    return { name, variant };
  }
  const items = order.cart_items;
  if (Array.isArray(items) && items.length > 0) {
    const first = items[0];
    const name =
      first.name ??
      first.product_name ??
      first.title ??
      first.product?.name ??
      first.product ??
      first;
    const variant =
      first.variant_name ??
      first.sku ??
      first.variant ??
      first.product?.variant ??
      first.product?.sku ??
      "";
    return { name: toDisplayText(name), variant: toDisplayText(variant, "") };
  }
  return { name: "—", variant: "" };
}

/** All cart / line items for table display: `{ name, quantity }[]`. */
export function orderCartProductLines(order) {
  if (order["Product Name"]) {
    const qty = order["Product Quantity"];
    return [
      {
        name: toDisplayText(order["Product Name"]),
        quantity:
          qty != null && qty !== "" && !Number.isNaN(Number(qty))
            ? Number(qty)
            : null,
      },
    ];
  }
  if (order.lineItemsSummary) {
    return [{ name: toDisplayText(order.lineItemsSummary), quantity: null }];
  }

  const items = order.cart_items ?? order.lineItems;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((item) => {
      const name =
        item?.name ??
        item?.product_name ??
        item?.title ??
        item?.product?.name ??
        (typeof item?.product === "string" ? item.product : null);
      const qty = Number(item?.quantity ?? item?.qty);
      return {
        name: toDisplayText(name),
        quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
        variationProp: formatOrderItemVariationProp(item),
      };
    });
  }

  const { name } = orderProductBlock(order);
  if (name && name !== "—") {
    return [{ name, quantity: null }];
  }
  return [];
}

export function orderUpdatedByName(order) {
  const v =
    order?.updated_by_name ??
    order?.updatedByName ??
    order?.updated_by?.name ??
    order?.last_updated_by_name ??
    order?.lastUpdatedByName;
  const s = String(v ?? "").trim();
  return s || "—";
}

export function orderQuantity(order) {
  if (order["Product Quantity"] != null && order["Product Quantity"] !== "") {
    return order["Product Quantity"];
  }
  const lineItems = order.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const sum = lineItems.reduce(
      (acc, i) => acc + (Number(i.quantity) || 0),
      0,
    );
    return sum || lineItems.length;
  }
  const items = order.cart_items;
  if (Array.isArray(items) && items.length > 0) {
    const sum = items.reduce(
      (acc, i) => acc + (Number(i.quantity ?? i.qty) || 0),
      0,
    );
    return sum || items.length;
  }
  return "—";
}

export function orderTotalCost(order) {
  const t = order.totals;
  if (t && typeof t === "object" && t.total != null && t.total !== "") {
    return t.total;
  }
  const v =
    order["Order Total Cost"] ??
    order.total_cost ??
    order.totalCost ??
    order.cost;
  return v != null && v !== "" ? v : null;
}

export function orderPayment(order) {
  const t = order.totals;
  if (t && typeof t === "object" && t.paymentMethod) {
    return t.paymentMethod;
  }
  return order["Payment Method"] ?? order.payment_method ?? "—";
}

export function orderDate(order) {
  const tl = order.timeline;
  if (tl && typeof tl === "object" && tl.createdAt) {
    return tl.createdAt;
  }
  if (order.webhookReceivedAt) {
    return order.webhookReceivedAt;
  }
  return order["Date"] ?? order.created_at ?? order.date ?? "—";
}

export function orderStatus(order) {
  return (
    order.orderStatus ??
    order.order_status ??
    order.status ??
    order["Order Status"] ??
    "—"
  );
}

const ORDER_TYPE_LABELS = {
  new: "أوردر جديد",
  replacement: "استبدال",
  return: "مرتجع",
};

/** نوع الطلب (new / replacement / return). */
export function orderType(order) {
  const v = order?.order_type ?? order?.orderType;
  if (v != null && String(v).trim() !== "") return String(v).trim();
  return null;
}

export function orderTypeDisplayLabel(value) {
  if (value == null || value === "") return null;
  const key = String(value).trim().toLowerCase();
  return ORDER_TYPE_LABELS[key] ?? String(value);
}

/** حالة الشحن من الطلب (للعرض مع «تم الشحن»). */
export function orderShippingStatus(order) {
  let v =
    order.shipping_status ?? order.shippingStatus ?? order["Shipping Status"];
  if (v != null && String(v).trim() !== "") return String(v).trim();

  let rd = order?.raw_data;
  if (typeof rd === "string") {
    try {
      rd = JSON.parse(rd);
    } catch {
      rd = null;
    }
  }
  if (rd && typeof rd === "object") {
    v = rd.shipping_status ?? rd.shippingStatus;
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** للتنقل لصفحة التفاصيل: الـ API عادة يتوقع uuid في `id` */
export function orderDetailRouteId(order) {
  return order.id ?? order["Order ID"] ?? order.shortId ?? order.short_id;
}

/** نص ملاحظة الطلب إن وُجدت. */
export function orderNote(order) {
  const raw =
    order?.note ?? order?.notes ?? order?.delivery_note ?? order?.deliveryNote;
  return String(raw ?? "").trim();
}

/** هل الطلب عليه ملاحظة غير فارغة؟ */
export function orderHasNote(order) {
  return orderNote(order) !== "";
}
