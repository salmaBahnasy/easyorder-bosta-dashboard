import { filterCartLinesForPayload } from "../pages/orders/cartCatalogHelpers";

function cartLineLabel(row, lineIndex) {
  const name = String(row?.name ?? row?.sku ?? "").trim();
  return name || `سطر ${lineIndex + 1}`;
}

/** Unit price entered by the employee in the cart row (not catalog). */
export function resolveUserEnteredLinePrice(row) {
  const raw = row?.price;
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function validateCartRowsPrices(cartItems) {
  const errors = [];
  const rows = filterCartLinesForPayload(cartItems);

  rows.forEach((row, lineIndex) => {
    const label = cartLineLabel(row, lineIndex);
    const price = resolveUserEnteredLinePrice(row);
    if (price == null) {
      errors.push(`أدخلي سعر الوحدة للمنتج: ${label}`);
    }
  });

  return errors;
}
