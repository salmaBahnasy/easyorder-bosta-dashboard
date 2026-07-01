import axios from "axios";
import { toApiQueryDate, normalizeApiDateParams, normalizeDateInput } from "../utils/dateRange";
import { getOrderAuditFields } from "../utils/orderAudit";
import {
  getDashboardApiPrefix,
  getStoredToken,
  handleSessionExpired,
  isTokenValid,
  isUnauthorizedApiError,
} from "../utils/auth";
import { logApiError, logApiRequest, logApiResponse } from "../utils/apiLogger";

const API_BASE_URL = "https://easyorder-bosta-backend.onrender.com"; //"http://127.0.0.1:5050";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    const url = String(config?.url ?? "");
    if (token && !url.includes("/auth/login")) {
      if (!isTokenValid(token)) {
        handleSessionExpired();
        return Promise.reject(new Error("انتهت صلاحية الجلسة"));
      }
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    logApiRequest("ordersApi", config);
    return config;
  },
  (error) => {
    logApiError("ordersApi", error);
    return Promise.reject(error);
  },
);

function dashboardApiPath(resourcePath) {
  const prefix = getDashboardApiPrefix();
  const r = String(resourcePath ?? "").replace(/^\/+/, "");
  return `${prefix}/${r}`;
}

function authorizedRequestConfig() {
  const token = getStoredToken();
  if (!token) {
    throw new Error("لا يوجد token — سجّلي الدخول أولاً");
  }
  if (!isTokenValid(token)) {
    handleSessionExpired();
    throw new Error("انتهت صلاحية الجلسة");
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

apiClient.interceptors.response.use(
  (response) => {
    logApiResponse("ordersApi", response);
    return response;
  },
  (error) => {
    logApiError("ordersApi", error);
    if (isUnauthorizedApiError(error)) {
      handleSessionExpired();
    }
    return Promise.reject(error);
  },
);

/**
 * Maps UI employee selection to `employee_id` / `employeeId` query value (employee UUID).
 */
export function resolveEmployeeOrderFilterParams(
  _employees,
  selectedEmployeeId,
) {
  const id = String(selectedEmployeeId ?? "").trim();
  if (!id) return {};
  return { employee_id: id };
}

/** Shared list/export filters — same query shape as `GET /orders`. */
export function buildOrdersListFilterParams({
  status,
  employee_id,
  employeeId,
  phone,
  customer_name,
  customerName,
  full_name,
  fullName,
  name,
  from,
  to,
  order_source,
  order_type,
  shipping_status,
  product_id,
  productId,
  product_sku,
  productSku,
  maxRows,
} = {}) {
  const employee = employee_id ?? employeeId;
  const product = product_id ?? productId;
  const sku = product_sku ?? productSku;
  const customerNameQuery = [
    customer_name,
    customerName,
    full_name,
    fullName,
    name,
  ]
    .map((v) => String(v ?? "").trim())
    .find(Boolean);

  const params = {
    status,
    employee_id: employee,
    phone,
    customer_name: customerNameQuery,
    from: toApiQueryDate(from, false),
    to: toApiQueryDate(to, true),
    order_source,
    order_type,
    shipping_status,
    product_id: product,
    product_sku: sku,
    maxRows,
  };

  return Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    ),
  );
}

function parseExportFilename(contentDisposition, fallback = "orders.xlsx") {
  const header = String(contentDisposition ?? "");
  if (!header) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() || fallback;
}

async function readBlobErrorMessage(blob) {
  try {
    const text = await blob.text();
    const json = JSON.parse(text);
    return json?.message ?? json?.error ?? null;
  } catch {
    return null;
  }
}

/** `GET /api/{system}/added-orders` */
export async function getAddedOrders({
  page = 1,
  limit = 50,
  from,
  to,
  employee_id,
  employeeId,
  product,
} = {}) {
  const params = {
    page,
    limit,
    from: toApiQueryDate(from, false),
    to: toApiQueryDate(to, true),
    employee_id: employee_id ?? employeeId,
    product,
  };
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    ),
  );
  const response = await apiClient.get(dashboardApiPath("added-orders"), {
    params: cleaned,
  });
  return response.data;
}

/** `POST /api/{system}/added-orders` */
export async function createAddedOrder(payload) {
  const response = await apiClient.post(
    dashboardApiPath("added-orders"),
    payload,
  );
  return response.data;
}

/** `GET /api/{system}/orders/reference/:orderReference?presented=true` */
export async function getOrderByReference(orderReference, { presented = true } = {}) {
  const ref = String(orderReference ?? "").trim();
  if (!ref) {
    throw new Error("order_reference مطلوب");
  }
  const response = await apiClient.get(
    dashboardApiPath(`orders/reference/${encodeURIComponent(ref)}`),
    {
      params: presented ? { presented: "true" } : undefined,
    },
  );
  return response.data;
}

export async function getOrders({
  page = 1,
  limit = 50,
  ...filterParams
} = {}) {
  const params = buildOrdersListFilterParams(filterParams);
  params.page = page;
  params.limit = limit;

  const response = await apiClient.get(dashboardApiPath("orders"), {
    params,
  });

  return response.data;
}

/** `GET /api/{system}/orders/export` — Excel download with same filters as list. */
export async function exportOrders(filterParams = {}) {
  const params = buildOrdersListFilterParams(filterParams);

  try {
    const response = await apiClient.get(dashboardApiPath("orders/export"), {
      params,
      responseType: "blob",
      ...authorizedRequestConfig(),
    });

    const contentType = String(response.headers?.["content-type"] ?? "");
    if (contentType.includes("application/json")) {
      const message = await readBlobErrorMessage(response.data);
      throw new Error(message ?? "تعذر تصدير الطلبات");
    }

    return {
      blob: response.data,
      filename: parseExportFilename(
        response.headers?.["content-disposition"],
        "orders.xlsx",
      ),
      total: response.headers?.["x-export-total"],
      rows: response.headers?.["x-export-rows"],
      truncated: String(response.headers?.["x-export-truncated"] ?? "").toLowerCase() === "true",
    };
  } catch (error) {
    const blob = error?.response?.data;
    if (blob instanceof Blob) {
      const message = await readBlobErrorMessage(blob);
      if (message) throw new Error(message);
    }
    throw error;
  }
}

export function downloadOrdersExportFile({ blob, filename = "orders.xlsx" }) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function getOrderDetails(orderId) {
  const response = await apiClient.get(dashboardApiPath(`orders/${orderId}`));
  return response.data;
}

export async function createOrder(payload) {
  const body = { ...payload, ...getOrderAuditFields() };
  const response = await apiClient.post(dashboardApiPath("orders"), body);
  return response.data;
}

export async function getZones() {
  const response = await axios.get(
    "https://api-fulfillment.bosta.co/api/v1/zones",
  );
  return response.data;
}

function buildBostaSearchParams({ q, search, name } = {}) {
  const term = String(q ?? search ?? name ?? "").trim();
  if (!term) return {};
  return { q: term };
}

/** Bosta cities — `GET /api/{system}/bosta/cities?q=...` */
export async function getBostaCities(searchParams = {}) {
  const response = await apiClient.get(dashboardApiPath("bosta/cities"), {
    params: buildBostaSearchParams(searchParams),
  });
  return response.data;
}

/** Bosta districts — `GET /api/{system}/bosta/cities/:cityId/districts?q=...` */
export async function getBostaDistricts(cityId, searchParams = {}) {
  const id = String(cityId ?? "").trim();
  if (!id) return { data: [] };
  const response = await apiClient.get(
    dashboardApiPath(`bosta/cities/${encodeURIComponent(id)}/districts`),
    { params: buildBostaSearchParams(searchParams) },
  );
  return response.data;
}

/** Bosta SKU mappings — `GET/POST /api/{system}/bosta/sku-mappings` */
export async function getSkuMappings() {
  const response = await apiClient.get(
    dashboardApiPath("bosta/sku-mappings"),
  );
  return response.data;
}

export async function getSkuMappingByType(mappingType, entityId) {
  const type = String(mappingType ?? "").trim();
  const id = String(entityId ?? "").trim();
  const response = await apiClient.get(
    dashboardApiPath(`bosta/sku-mappings/${type}/${encodeURIComponent(id)}`),
  );
  return response.data;
}

/** Bosta SKUs for a product — `GET /api/{system}/bosta/sku-mappings/by-product/:productId` */
export async function getBostaSkusByProduct(productId) {
  const id = String(productId ?? "").trim();
  if (!id) return null;
  const response = await apiClient.get(
    dashboardApiPath(`bosta/sku-mappings/by-product/${encodeURIComponent(id)}`),
  );
  return response.data;
}

export async function createSkuMapping(payload) {
  const response = await apiClient.post(
    dashboardApiPath("bosta/sku-mappings"),
    payload,
  );
  return response.data;
}

export async function importSkuMappings(payload) {
  const response = await apiClient.post(
    dashboardApiPath("bosta/sku-mappings/import"),
    payload,
  );
  return response.data;
}

export async function updateSkuMapping(mappingType, entityId, payload) {
  const type = String(mappingType ?? "").trim();
  const id = String(entityId ?? "").trim();
  const response = await apiClient.put(
    dashboardApiPath(`bosta/sku-mappings/${type}/${encodeURIComponent(id)}`),
    payload,
  );
  return response.data;
}

export async function patchSkuMapping(mappingType, entityId, payload) {
  const type = String(mappingType ?? "").trim();
  const id = String(entityId ?? "").trim();
  const response = await apiClient.patch(
    dashboardApiPath(`bosta/sku-mappings/${type}/${encodeURIComponent(id)}`),
    payload,
  );
  return response.data;
}

export async function deleteSkuMapping(mappingType, entityId) {
  const type = String(mappingType ?? "").trim();
  const id = String(entityId ?? "").trim();
  const response = await apiClient.delete(
    dashboardApiPath(`bosta/sku-mappings/${type}/${encodeURIComponent(id)}`),
  );
  return response.data;
}

export async function deleteUnmappedSku(unmappedId) {
  const id = String(unmappedId ?? "").trim();
  const response = await apiClient.delete(
    dashboardApiPath(`bosta/sku-mappings/unmapped/${encodeURIComponent(id)}`),
  );
  return response.data;
}

export async function updateOrderStatus(orderId, status) {
  const body = { status, ...getOrderAuditFields() };
  const response = await apiClient.patch(
    dashboardApiPath(`orders/${orderId}/status`),
    body,
  );
  return response.data;
}

export async function updateOrder(orderId, payload) {
  const body = { ...payload, ...getOrderAuditFields() };
  const response = await apiClient.patch(
    dashboardApiPath(`orders/${orderId}`),
    body,
  );
  return response.data;
}

/** إرسال الطلب إلى بوسطة — `POST /api/{system}/orders/:orderId/send-to-bosta` */
export async function sendOrderToBosta(
  orderId,
  {
    cityId,
    districtId,
    firstLine,
    mobile,
    payment_method,
    note,
    allowToOpenPackage,
    lineSkus,
  } = {},
) {
  const body = {
    cityId: String(cityId ?? "").trim(),
    districtId: String(districtId ?? "").trim(),
    firstLine: String(firstLine ?? "").trim(),
    mobile: String(mobile ?? "").trim(),
    payment_method: String(payment_method ?? "").trim(),
    allowToOpenPackage: Boolean(allowToOpenPackage),
  };

  const trimmedNote = String(note ?? "").trim();
  if (trimmedNote) body.note = trimmedNote;

  if (Array.isArray(lineSkus) && lineSkus.length > 0) {
    body.lineSkus = lineSkus
      .map((entry, index) => ({
        lineIndex: Number.isFinite(Number(entry?.lineIndex))
          ? Number(entry.lineIndex)
          : index,
        skuCode: String(entry?.skuCode ?? entry?.sku ?? "").trim(),
      }))
      .filter((entry) => entry.skuCode);
  }

  const response = await apiClient.post(
    dashboardApiPath(`orders/${orderId}/send-to-bosta`),
    body,
    authorizedRequestConfig(),
  );
  return response.data;
}

function cleanApiParams(params = {}) {
  return Object.fromEntries(
    Object.entries(normalizeApiDateParams(params)).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    ),
  );
}

export async function getOrdersStats(params = {}) {
  const response = await apiClient.get(dashboardApiPath("orders/stats"), {
    params: cleanApiParams(params),
  });
  return response.data;
}

/** Orders trend + summary KPIs — `GET /api/{system}/orders/stats/trend` */
export async function getOrdersStatsTrend(params = {}) {
  const response = await apiClient.get(dashboardApiPath("orders/stats/trend"), {
    params: cleanApiParams(params),
  });
  return response.data;
}

/** Product sales chart — `GET /api/{system}/charts/product-sales` */
export async function getProductSalesChart(params = {}) {
  const response = await apiClient.get(dashboardApiPath("charts/product-sales"), {
    params: cleanApiParams(params),
  });
  return response.data;
}

/** Order cost metrics — `GET /api/{system}/costs` */
export async function getOrderCosts(params = {}) {
  const response = await apiClient.get(dashboardApiPath("costs"), {
    params: cleanApiParams(params),
  });
  return response.data;
}

/** Order cost chart — `GET /api/{system}/charts/order-cost?from=&to=&date_basis=` */
export async function getOrderCostChart({ from, to, date_basis } = {}) {
  const params = cleanApiParams({ from, to, date_basis });
  const response = await apiClient.get(dashboardApiPath("charts/order-cost"), {
    params,
  });
  return response.data;
}

/** Save one day expense + order counts — `POST /api/{system}/charts/order-cost?date_basis=` */
export async function saveOrderCostDay({ date, expense, date_basis } = {}) {
  const day = normalizeDateInput(date) || String(date ?? "").trim();
  const body = { date: day, expense: Number(expense) };
  const params = cleanApiParams({ date_basis });
  const url = dashboardApiPath("charts/order-cost");

  console.log("[ordersApi] saveOrderCostDay REQUEST", { method: "POST", url, body });

  try {
    const response = await apiClient.post(url, body, { params });
    console.log("[ordersApi] saveOrderCostDay RESPONSE", {
      status: response.status,
      data: response.data,
    });
    return response.data;
  } catch (error) {
    console.log("[ordersApi] saveOrderCostDay RESPONSE ERROR", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

export async function getOrdersAnalytics(params = {}) {
  const response = await apiClient.get(dashboardApiPath("orders/analytics"), {
    params: cleanApiParams(params),
  });
  return response.data;
}

export async function getProducts({ page = 1, limit = 50, search } = {}) {
  const params = { page, limit };
  const q = typeof search === "string" ? search.trim() : "";
  if (q) params.search = q;
  const response = await apiClient.get(dashboardApiPath("products"), {
    params,
  });
  return response.data;
}

export async function getProductById(productId) {
  const response = await apiClient.get(
    dashboardApiPath(`products/${productId}`),
  );
  return response.data;
}

export async function createProduct(payload) {
  const response = await apiClient.post(dashboardApiPath("products"), payload);
  return response.data;
}

export async function updateProduct(productId, payload) {
  const response = await apiClient.patch(
    dashboardApiPath(`products/${productId}`),
    payload,
  );
  return response.data;
}

/**
 * @param {"easyorder" | "salla"} system
 */
export async function loginDashboard(system, { email, password }) {
  const prefix = system === "salla" ? "/api/salla" : "/api/easyorder";
  const response = await apiClient.post(`${prefix}/auth/login`, {
    email,
    password,
  });
  return response.data;
}

export async function getEmployees() {
  const response = await apiClient.get(dashboardApiPath("employees"));
  return response.data;
}

export async function createEmployee({
  name,
  email,
  password,
  is_active,
  employeeRole,
}) {
  const privilege =
    employeeRole != null && String(employeeRole).trim() !== ""
      ? normalizeEmployeeRoleForApi(employeeRole)
      : "employee";

  const response = await apiClient.post(dashboardApiPath("employees"), {
    name,
    email,
    password,
    role: privilege,
    employeeRole: privilege,
    is_active: Boolean(is_active),
  });
  return response.data;
}

function normalizeEmployeeRoleForApi(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "admin" ? "admin" : "employee";
}

export async function updateEmployee(employeeId, payload) {
  const response = await apiClient.patch(
    dashboardApiPath(`employees/${employeeId}`),
    payload,
  );
  return response.data;
}

export async function deleteEmployee(employeeId) {
  const response = await apiClient.delete(
    dashboardApiPath(`employees/${employeeId}`),
  );
  return response.data;
}
