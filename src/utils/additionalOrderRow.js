import { orderShippingStatus, orderStatus } from "./orderDisplay";

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

/** حالة الشحن «تم الشحن بنجاح» — الصف يصبح أخضر فاتح. */
export function isAdditionalOrderShippingSuccess(order) {
  const shipRaw = orderShippingStatus(order);
  if (!shipRaw) return false;

  const ship = String(shipRaw).trim();
  const shipNorm = normalizeToken(ship);

  if (ship.includes("تم الشحن بنجاح")) return true;
  if (shipNorm === "shipped success" || shipNorm === "delivered success") {
    return true;
  }
  if (shipNorm === "delivered" || shipNorm === "success") return true;

  return false;
}

export function isAdditionalOrderShipped(order) {
  const status = normalizeToken(orderStatus(order));
  return (
    status === "shipped" ||
    status === "تم الشحن" ||
    status.includes("shipped")
  );
}

/** `pending` → خلفية حمراء فاتحة، `success` → خضراء فاتحة */
export function getAdditionalOrderRowTone(order) {
  return isAdditionalOrderShippingSuccess(order) ? "success" : "pending";
}

export function additionalOrderRowStatusLabel(order) {
  const ship = orderShippingStatus(order);
  const status = orderStatus(order);
  if (isAdditionalOrderShippingSuccess(order)) {
    return ship ? `شحن: ${ship}` : "تم الشحن بنجاح";
  }
  const parts = [];
  if (status && status !== "—") parts.push(`حالة: ${status}`);
  if (ship) parts.push(`شحن: ${ship}`);
  return parts.join(" · ") || "لم يُشحن بعد";
}

export function parseOrderFromReferenceResponse(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}
