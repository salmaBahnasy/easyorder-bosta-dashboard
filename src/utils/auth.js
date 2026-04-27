const TOKEN_STORAGE_KEY = "easyorder_token";

function decodeJwtPayload(token) {
  try {
    const parts = String(token ?? "").split(".");
    if (parts.length < 2) return null;
    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadBase64.padEnd(
      payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
      "="
    );
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem("easyorder_user");
}

export function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return false;

  const exp = Number(payload.exp);
  if (!exp) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp > nowSeconds;
}

export function hasValidStoredToken() {
  const token = getStoredToken();
  const valid = isTokenValid(token);
  if (!valid) {
    clearAuthStorage();
  }
  return valid;
}
