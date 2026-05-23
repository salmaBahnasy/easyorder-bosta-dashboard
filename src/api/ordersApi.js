import axios from "axios";
import { toApiQueryDate, normalizeApiDateParams } from "../utils/dateRange";
import { getOrderAuditFields } from "../utils/orderAudit";
import { getDashboardApiPrefix } from "../utils/auth";

const API_BASE_URL = "https://easyorder-bosta-backend.onrender.com"; //"http://127.0.0.1:5050";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("easyorder_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    const fullUrl = `${config.baseURL ?? ""}${config.url ?? ""}`;
    console.log("[ordersApi] REQUEST", {
      method: (config.method ?? "get").toUpperCase(),
      url: fullUrl,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.log("[ordersApi] REQUEST ERROR", error);
    return Promise.reject(error);
  },
);

function dashboardApiPath(resourcePath) {
  const prefix = getDashboardApiPrefix();
  const r = String(resourcePath ?? "").replace(/^\/+/, "");
  return `${prefix}/${r}`;
}

apiClient.interceptors.response.use(
  (response) => {
    console.log("[ordersApi] RESPONSE", {
      status: response.status,
      url: response.config?.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    const res = error.response;
    console.log("[ordersApi] RESPONSE ERROR", {
      message: error.message,
      status: res?.status,
      url: res?.config?.url,
      data: res?.data,
    });
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

export async function getOrders({
  page = 1,
  limit = 50,
  status,
  employee_id,
  employeeId,
  phone,
  from,
  to,
  order_source,
  order_type,
  shipping_status,
  product_id,
  productId,
  product_sku,
  productSku,
} = {}) {
  const employee = employee_id ?? employeeId;
  const product = product_id ?? productId;
  const sku = product_sku ?? productSku;
  const params = {
    page,
    limit,
    status,
    employee_id: employee,
    phone,
    from: toApiQueryDate(from, false),
    to: toApiQueryDate(to, true),
    order_source,
    order_type,
    shipping_status,
    product_id: product,
    product_sku: sku,
  };

  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    ),
  );

  const response = await apiClient.get(dashboardApiPath("orders"), {
    params: cleaned,
  });

  return response.data;
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

/** Bosta cities list — `GET /api/{system}/bosta/cities` */
export async function getBostaCities() {
  const response = await apiClient.get(dashboardApiPath("bosta/cities"));
  return response.data;
}

/** Bosta districts for a city — `GET /api/{system}/bosta/cities/:cityId/districts` */
export async function getBostaDistricts(cityId) {
  const id = String(cityId ?? "").trim();
  if (!id) return { data: [] };
  const response = await apiClient.get(
    dashboardApiPath(`bosta/cities/${encodeURIComponent(id)}/districts`),
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
