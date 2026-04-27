import axios from "axios";

const EASY_ORDERS_BASE_URL = "https://api.easy-orders.net";

const easyOrdersClient = axios.create({
  baseURL: EASY_ORDERS_BASE_URL,
});

easyOrdersClient.interceptors.request.use(
  (config) => {
    const key = import.meta.env.VITE_EASY_ORDERS_API_KEY;
    if (key) {
      config.headers["Api-Key"] = key;
    }
    const fullUrl = `${config.baseURL ?? ""}${config.url ?? ""}`;
    console.log("[easyOrdersApi] REQUEST", {
      method: (config.method ?? "get").toUpperCase(),
      url: fullUrl,
      params: config.params,
    });
    return config;
  },
  (error) => Promise.reject(error)
);

easyOrdersClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("[easyOrdersApi] RESPONSE ERROR", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

/**
 * External apps products (requires Api-Key header).
 * Env: VITE_EASY_ORDERS_API_KEY in `.env`
 */
export async function getExternalProducts({ page = 1, limit = 20, search } = {}) {
  const params = { page, limit };
  const q = typeof search === "string" ? search.trim() : "";
  if (q) params.search = q;

  const response = await easyOrdersClient.get(
    "/api/v1/external-apps/products",
    { params }
  );
  return response.data;
}
