import axios from "axios";
import { getOrderAuditFields } from "../utils/orderAudit";

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

function normalizeOrderQueryDate(value, endOfDay) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return endOfDay ? `${s}T23:59:59.999Z` : `${s}T00:00:00.000Z`;
  }
  return s;
}

/**
 * Maps UI employee selection to `employee_id` / `employeeId` query value:
 * backend accepts either the employee UUID or their email in that single param.
 */
export function resolveEmployeeOrderFilterParams(employees, selectedEmployeeId) {
  const id = String(selectedEmployeeId ?? "").trim();
  if (!id) return {};
  const emp = Array.isArray(employees)
    ? employees.find(
        (e) => String(e?.id ?? e?._id ?? e?.employeeId ?? "").trim() === id,
      )
    : null;
  const email = String(emp?.email ?? emp?.user_email ?? emp?.userEmail ?? "").trim();
  return { employee_id: email || id };
}

export async function getOrders({
  page = 1,
  limit = 20,
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
    from: normalizeOrderQueryDate(from, false),
    to: normalizeOrderQueryDate(to, true),
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

  const response = await apiClient.get("/api/orders", { params: cleaned });

  return response.data;
}

export async function getOrderDetails(orderId) {
  const response = await apiClient.get(`/api/orders/${orderId}`);
  return response.data;
}

export async function createOrder(payload) {
  const body = { ...payload, ...getOrderAuditFields() };
  const response = await apiClient.post("/api/orders", body);
  return response.data;
}

export async function getZones() {
  const response = await axios.get(
    "https://api-fulfillment.bosta.co/api/v1/zones",
  );
  return response.data;
}

export async function updateOrderStatus(orderId, status) {
  const body = { status, ...getOrderAuditFields() };
  const response = await apiClient.patch(`/api/orders/${orderId}/status`, body);
  return response.data;
}

export async function updateOrder(orderId, payload) {
  const body = { ...payload, ...getOrderAuditFields() };
  const response = await apiClient.patch(`/api/orders/${orderId}`, body);
  return response.data;
}

export async function getOrdersStats(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    ),
  );
  const response = await apiClient.get("/api/orders/stats", { params: clean });
  return response.data;
}

export async function getProducts({ page = 1, limit = 50, search } = {}) {
  const params = { page, limit };
  const q = typeof search === "string" ? search.trim() : "";
  if (q) params.search = q;
  const response = await apiClient.get("/api/products", { params });
  return response.data;
}

export async function getProductById(productId) {
  const response = await apiClient.get(`/api/products/${productId}`);
  return response.data;
}

export async function createProduct(payload) {
  const response = await apiClient.post("/api/products", payload);
  return response.data;
}

export async function updateProduct(productId, payload) {
  const response = await apiClient.patch(`/api/products/${productId}`, payload);
  return response.data;
}

export async function loginSenior({ email, password }) {
  const response = await apiClient.post("/api/employees/login-senior", {
    email,
    password,
  });
  return response.data;
}

export async function getEmployees() {
  const response = await apiClient.get("/api/employees");
  return response.data;
}

export async function createEmployee({ name, email, password, role }) {
  const response = await apiClient.post("/api/employees", {
    name,
    email,
    password,
    role,
  });
  return response.data;
}

export async function updateEmployee(employeeId, payload) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}`,
    payload,
  );
  return response.data;
}

export async function deleteEmployee(employeeId) {
  const response = await apiClient.delete(`/api/employees/${employeeId}`);
  return response.data;
}
