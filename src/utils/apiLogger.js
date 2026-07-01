/** Set VITE_API_DEBUG=true in .env to log API traffic in production builds. */
export function isApiLoggingEnabled() {
  return import.meta.env.DEV || String(import.meta.env.VITE_API_DEBUG ?? "") === "true";
}

function buildFullUrl(config) {
  const base = String(config?.baseURL ?? "").replace(/\/$/, "");
  const path = String(config?.url ?? "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function summarizeResponseData(response) {
  const isBlob = response?.config?.responseType === "blob";
  if (isBlob) {
    const blob = response.data;
    return {
      type: "blob",
      size: blob?.size ?? null,
      mimeType: blob?.type ?? null,
      headers: response.headers,
    };
  }
  return response.data;
}

export function logApiRequest(tag, config) {
  if (!isApiLoggingEnabled()) return;

  const method = String(config?.method ?? "get").toUpperCase();
  const url = buildFullUrl(config);
  const label = `[${tag}] REQUEST ${method} ${url}`;

  if (typeof console.groupCollapsed === "function") {
    console.groupCollapsed(label);
    console.log("params:", config?.params ?? null);
    console.log("data:", config?.data ?? null);
    if (config?.responseType) console.log("responseType:", config.responseType);
    console.groupEnd();
    return;
  }

  console.log(label, {
    params: config?.params ?? null,
    data: config?.data ?? null,
    responseType: config?.responseType,
  });
}

export function logApiResponse(tag, response) {
  if (!isApiLoggingEnabled()) return;

  const status = response?.status;
  const url = response?.config?.url ?? buildFullUrl(response?.config);
  const label = `[${tag}] RESPONSE ${status} ${url}`;

  const payload = summarizeResponseData(response);

  if (typeof console.groupCollapsed === "function") {
    console.groupCollapsed(label);
    console.log("data:", payload);
    console.groupEnd();
    return;
  }

  console.log(label, { data: payload });
}

export function logApiError(tag, error) {
  if (!isApiLoggingEnabled()) return;

  const res = error?.response;
  const label = `[${tag}] RESPONSE ERROR ${res?.status ?? "—"} ${res?.config?.url ?? ""}`;

  if (typeof console.groupCollapsed === "function") {
    console.groupCollapsed(label);
    console.log("message:", error?.message);
    console.log("status:", res?.status ?? null);
    console.log("data:", res?.data ?? null);
    console.groupEnd();
    return;
  }

  console.log(label, {
    message: error?.message,
    status: res?.status,
    data: res?.data,
  });
}
