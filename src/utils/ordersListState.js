import { getSelectedSystem } from "./auth";
import { egyptTodayYmd } from "./dateRange";

export function getDefaultOrdersFilters() {
  const today = egyptTodayYmd();
  return {
    status: "",
    employee: "",
    customer_name: "",
    phone: "",
    from: today,
    to: today,
    order_source: "",
    order_type: "",
    shipping_status: "",
    product_id: "",
  };
}

function storageKey() {
  const system = getSelectedSystem() || "easyorder";
  return `orders_list_state_${system}`;
}

export function readOrdersListState() {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const defaults = getDefaultOrdersFilters();
    const merged = { ...defaults, ...(parsed.filters ?? {}) };
    if (!String(merged.from ?? "").trim() && !String(merged.to ?? "").trim()) {
      merged.from = defaults.from;
      merged.to = defaults.to;
    }
    const focusedOrderId = String(parsed.focusedOrderId ?? "").trim();
    return {
      filters: merged,
      page: Number(parsed.page) > 0 ? Number(parsed.page) : 1,
      focusedOrderId: focusedOrderId || null,
    };
  } catch {
    return null;
  }
}

export function writeOrdersListState({ filters, page, focusedOrderId }) {
  try {
    const payload = {
      filters: { ...getDefaultOrdersFilters(), ...filters },
      page: Number(page) > 0 ? Number(page) : 1,
    };
    const focusId = String(focusedOrderId ?? "").trim();
    if (focusId) payload.focusedOrderId = focusId;
    sessionStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearOrdersListState() {
  try {
    sessionStorage.removeItem(storageKey());
  } catch {
    // ignore
  }
}

/**
 * Initial list state when opening the orders page.
 * Fresh visit → today's date + page 1. Return from details → keep saved filters/page.
 */
export function resolveOrdersListBootState(locationState) {
  const fromNavigationState = Boolean(locationState?.ordersListState);
  const stored = locationState?.ordersListState ?? readOrdersListState();
  const fromDetails =
    fromNavigationState || Boolean(stored?.focusedOrderId);
  const today = egyptTodayYmd();
  const defaults = getDefaultOrdersFilters();

  let filters = { ...defaults, ...(stored?.filters ?? {}) };
  let page = Number(stored?.page) > 0 ? Number(stored.page) : 1;

  if (!fromDetails) {
    filters = { ...filters, from: today, to: today };
    page = 1;
  } else if (!String(filters.from ?? "").trim() && !String(filters.to ?? "").trim()) {
    filters = { ...filters, from: today, to: today };
  }

  const focusedOrderId =
    fromDetails && stored?.focusedOrderId ? stored.focusedOrderId : null;

  return { filters, page, fromDetails, focusedOrderId };
}
