import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:5050";

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
  }
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
  }
);

export async function getOrders({
  page = 1,
  limit = 20,
  status,
  employeeId,
  from,
  to,
} = {}) {
  const response = await apiClient.get("/api/orders", {
    params: {
      page,
      limit,
      status,
      employeeId,
      from,
      to,
    },
  });

  return response.data;
}

export async function getOrderDetails(orderId) {
  const response = await apiClient.get(`/api/orders/${orderId}`);
  return response.data;
}

export async function createOrder(payload) {
  const response = await apiClient.post("/api/orders", payload);
  return response.data;
}

export async function getZones() {
  const response = await axios.get(
    "https://api-fulfillment.bosta.co/api/v1/zones"
  );
  return response.data;
}

export async function updateOrderStatus(orderId, status) {
  const response = await apiClient.patch(`/api/orders/${orderId}/status`, {
    status,
  });
  return response.data;
}

export async function updateOrder(orderId, payload) {
  const response = await apiClient.patch(`/api/orders/${orderId}`, payload);
  return response.data;
}

export async function getOrdersStats() {
  const response = await apiClient.get("/api/orders/stats");
  return response.data;
}

export async function getProducts({ page = 1, limit = 50, search } = {}) {
  const params = { page, limit };
  const q = typeof search === "string" ? search.trim() : "";
  if (q) params.search = q;
  const response = await apiClient.get("/api/products", { params });
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
  const response = await apiClient.patch(`/api/employees/${employeeId}`, payload);
  return response.data;
}

export async function deleteEmployee(employeeId) {
  const response = await apiClient.delete(`/api/employees/${employeeId}`);
  return response.data;
}
