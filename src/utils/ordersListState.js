import { getSelectedSystem } from "./auth";

export function getDefaultOrdersFilters() {
  return {
    status: "",
    employee: "",
    customer_name: "",
    phone: "",
    from: "",
    to: "",
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
    return {
      filters: { ...getDefaultOrdersFilters(), ...(parsed.filters ?? {}) },
      page: Number(parsed.page) > 0 ? Number(parsed.page) : 1,
    };
  } catch {
    return null;
  }
}

export function writeOrdersListState({ filters, page }) {
  try {
    sessionStorage.setItem(
      storageKey(),
      JSON.stringify({
        filters: { ...getDefaultOrdersFilters(), ...filters },
        page: Number(page) > 0 ? Number(page) : 1,
      }),
    );
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
