import { isManualSystemOrder, orderCustomerStatus } from "./orderDisplay";

export function resolveCustomerStatusRefreshOrderId(order) {
  return (
    order?.sourceOrderId ??
    order?.source_order_id ??
    order?.order_id ??
    order?.orderId ??
    order?.id ??
    order?.["Order ID"] ??
    null
  );
}

/** هل ينفع نحدّث الحالة؟ (لا للطلبات اليدوية) */
export function canRefreshCustomerStatus(order) {
  if (!order) return false;
  if (isManualSystemOrder(order)) return false;
  return Boolean(String(resolveCustomerStatusRefreshOrderId(order) ?? "").trim());
}

export function normalizeCustomerStatusToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

export function isPendingCustomerStatus(orderOrStatus) {
  if (
    orderOrStatus &&
    typeof orderOrStatus === "object" &&
    isManualSystemOrder(orderOrStatus)
  ) {
    return false;
  }
  const raw =
    typeof orderOrStatus === "object" && orderOrStatus !== null
      ? orderCustomerStatus(orderOrStatus)
      : orderOrStatus;
  const key = normalizeCustomerStatusToken(raw);
  return key === "pending" || key === "";
}

export function pickCustomerStatusFromRefreshResult(result) {
  const next =
    result?.data?.customerStatus ??
    result?.data?.order?.customerStatus ??
    result?.data?.order?.customer_status ??
    result?.data?.easyConfirm ??
    result?.data?.easyconfirm ??
    result?.customerStatus ??
    result?.easyConfirm ??
    result?.easyconfirm ??
    null;
  const text = String(next ?? "").trim();
  return text || null;
}

export function applyCustomerStatusToOrder(order, statusValue) {
  const status = String(statusValue ?? "").trim();
  if (!status || !order || typeof order !== "object") return order;
  return {
    ...order,
    customerStatus: status,
    customer_status: status,
    easyConfirm: status,
    easyconfirm: status,
  };
}
