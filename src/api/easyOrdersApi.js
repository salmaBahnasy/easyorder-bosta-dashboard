import axios from "axios";
import { logApiError, logApiRequest, logApiResponse } from "../utils/apiLogger";

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
    logApiRequest("easyOrdersApi", config);
    return config;
  },
  (error) => Promise.reject(error),
);

easyOrdersClient.interceptors.response.use(
  (response) => {
    logApiResponse("easyOrdersApi", response);
    return response;
  },
  (error) => {
    logApiError("easyOrdersApi", error);
    return Promise.reject(error);
  },
);

/**
 * External apps products (requires Api-Key header).
 * Env: VITE_EASY_ORDERS_API_KEY in `.env`
 */
export async function getExternalProducts({
  page = 1,
  limit = 20,
  search,
} = {}) {
  const params = { page, limit };
  const q = typeof search === "string" ? search.trim() : "";
  if (q) params.search = q;

  const response = await easyOrdersClient.get(
    "/api/v1/external-apps/products",
    { params },
  );
  return response.data;
}
