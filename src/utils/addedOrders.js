import { createEmptyCartRow } from "../pages/orders/cartCatalogHelpers";

export function createEmptyAddedProduct() {
  return createEmptyCartRow();
}

function addedProductUnitPrice(item) {
  const raw = item?.price ?? item?.cost ?? "";
  if (raw === "" || raw == null) return 0;
  return Number(raw) || 0;
}

export function normalizeAddedProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return [createEmptyAddedProduct()];
  }
  return products.map((item, index) => {
    const unit = item?.cost ?? item?.price ?? "";
    return {
      key: item?.key ?? `prod-${index}-${item?.name ?? "row"}`,
      sku: String(item?.sku ?? ""),
      name: String(item?.name ?? ""),
      variant: String(item?.variant ?? ""),
      quantity: Math.max(1, Number(item?.quantity) || 1),
      price: unit === "" || unit == null ? "" : Number(unit) || String(unit),
      catalogProductId: item?.catalogProductId ?? null,
      catalogProductKey: String(item?.catalogProductKey ?? ""),
      catalogOptionId: String(item?.catalogOptionId ?? ""),
    };
  });
}

export function computeAddedProductsTotal(products) {
  return (products ?? []).reduce((sum, item) => {
    const q = Number(item?.quantity) || 0;
    return sum + q * addedProductUnitPrice(item);
  }, 0);
}

export function parseAddedOrdersResponse(payload) {
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return {
    list,
    page: Number(payload?.page) > 0 ? Number(payload.page) : 1,
    limit: Number(payload?.limit) > 0 ? Number(payload.limit) : 50,
    total: Number(payload?.total) >= 0 ? Number(payload.total) : list.length,
    totalPages: Number(payload?.totalPages) > 0 ? Number(payload.totalPages) : 1,
  };
}

export function buildAddedOrderPayload(row) {
  const products = (row.products ?? [])
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      quantity: Number(item.quantity) || 1,
      cost: addedProductUnitPrice(item),
    }))
    .filter((item) => item.name);

  const totalCost =
    Number(row.totalCost) > 0
      ? Number(row.totalCost)
      : computeAddedProductsTotal(products);

  return {
    customerName: String(row.customerName ?? "").trim(),
    phone: String(row.phone ?? "").trim(),
    products,
    totalCost,
  };
}

export function validateAddedOrderRow(row) {
  const errors = [];
  if (!String(row.customerName ?? "").trim()) {
    errors.push("اسم العميل مطلوب");
  }
  if (!String(row.phone ?? "").trim()) {
    errors.push("رقم التليفون مطلوب");
  }

  const products = (row.products ?? []).filter((item) =>
    String(item?.name ?? "").trim(),
  );
  if (products.length === 0) {
    errors.push("أضيفي منتجاً واحداً على الأقل");
    return errors;
  }

  products.forEach((item, index) => {
    const label = `منتج ${index + 1}`;
    const quantity = Number(item.quantity);
    const cost = addedProductUnitPrice(item);
    if (!String(item?.name ?? "").trim()) {
      errors.push(`${label}: اختاري منتجاً من الكتالوج`);
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push(`${label}: عدد القطع يجب أن يكون 1 على الأقل`);
    }
    if (!Number.isFinite(cost) || cost < 0) {
      errors.push(`${label}: أدخلي سعراً صالحاً`);
    }
  });

  return errors;
}

function pickText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "—") return text;
  }
  return "";
}

/** اسم الموظف الذي سجّل الطلب الإضافي (`addedBy` من الـ API). */
export function resolveAddedByDisplayName(record) {
  if (!record || typeof record !== "object") return "";

  const by = record.addedBy ?? record.added_by ?? null;
  if (by && typeof by === "object") {
    return pickText(by.name, by.full_name, by.email);
  }

  const emp = record.employee;
  if (emp && typeof emp === "object") {
    return pickText(emp.name, emp.full_name, emp.email);
  }

  return pickText(
    record.addedByName,
    record.added_by_name,
    record.employeeName,
    record.employee_name,
  );
}

export function mapAddedOrderRecordToRow(record, index = 0) {
  const products = normalizeAddedProducts(record?.products);
  const ref =
    record?.order_reference ??
    record?.orderReference ??
    record?.order?.order_reference ??
    record?.order?.orderReference ??
    "";

  return {
    key: record?.id ? `added-${record.id}` : `added-list-${index}`,
    id: record?.id ?? null,
    saved: true,
    orderReference: ref ? String(ref) : "—",
    order: record?.order ?? record,
    customerName: String(record?.customerName ?? ""),
    phone: String(record?.phone ?? ""),
    addedByName: resolveAddedByDisplayName(record),
    products,
    totalCost: Number(record?.totalCost) || computeAddedProductsTotal(products),
  };
}
