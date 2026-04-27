export function orderRowKey(order, index = 0) {
  const k =
    order["Order ID"] ?? order.id ?? order.shortId ?? order.short_id;
  if (k != null && k !== "") return String(k);
  return `row-${index}`;
}

/** معرّف للعرض في الجدول */
export function orderDisplayId(order) {
  const v =
    order["Order ID"] ??
    order.shortId ??
    order.short_id ??
    order.id;
  return v != null && v !== "" ? v : "—";
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
      name: order["Product Name"],
      variant: order["Product Variant"] ?? "",
    };
  }
  if (order.lineItemsSummary) {
    return { name: order.lineItemsSummary, variant: "" };
  }
  const lineItems = order.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const first = lineItems[0];
    const name = first.name ?? "—";
    const variant = first.sku ?? "";
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
      "—";
    const variant =
      first.variant_name ??
      first.sku ??
      first.variant ??
      first.product?.variant ??
      first.product?.sku ??
      "";
    return { name, variant };
  }
  return { name: "—", variant: "" };
}

export function orderQuantity(order) {
  if (order["Product Quantity"] != null && order["Product Quantity"] !== "") {
    return order["Product Quantity"];
  }
  const lineItems = order.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const sum = lineItems.reduce(
      (acc, i) => acc + (Number(i.quantity) || 0),
      0
    );
    return sum || lineItems.length;
  }
  const items = order.cart_items;
  if (Array.isArray(items) && items.length > 0) {
    const sum = items.reduce(
      (acc, i) => acc + (Number(i.quantity ?? i.qty) || 0),
      0
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

/** للتنقل لصفحة التفاصيل: الـ API عادة يتوقع uuid في `id` */
export function orderDetailRouteId(order) {
  return order.id ?? order["Order ID"] ?? order.shortId ?? order.short_id;
}
