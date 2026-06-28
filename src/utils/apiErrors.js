function pushPart(parts, value) {
  const text = String(value ?? "").trim();
  if (text && !parts.includes(text)) parts.push(text);
}

function collectNestedMessages(parts, details) {
  if (!details || typeof details !== "object") return;

  if (Array.isArray(details.messages)) {
    details.messages.forEach((entry) => pushPart(parts, entry));
  }

  if (Array.isArray(details.errors)) {
    details.errors.forEach((entry) => {
      if (typeof entry === "string") pushPart(parts, entry);
      else pushPart(parts, entry?.message);
    });
  }

  if (typeof details.message === "string") {
    pushPart(parts, details.message);
  }
}

function isBostaProxyError(data) {
  if (!data || typeof data !== "object") return false;
  if (data.details?.errorCode && data.details?.meta?.correlationId) return true;
  const errors = data.errors;
  return (
    Array.isArray(errors) &&
    errors.some((entry) => String(entry ?? "").toLowerCase().includes("bosta"))
  );
}

/** Builds a user-visible message from axios/API error payloads. */
export function formatApiErrorMessage(error, fallback = "حدث خطأ") {
  const data = error?.response?.data;

  if (!data) {
    const msg = String(error?.message ?? "").trim();
    if (msg && msg !== "Network Error") return msg;
    return fallback;
  }

  if (typeof data === "string") {
    const text = data.trim();
    return text || fallback;
  }

  const parts = [];
  pushPart(parts, data.message);
  pushPart(parts, data.error);

  if (Array.isArray(data.errors)) {
    data.errors.forEach((entry) => {
      if (typeof entry === "string") pushPart(parts, entry);
      else pushPart(parts, entry?.message);
    });
  } else if (data.errors && typeof data.errors === "object") {
    Object.entries(data.errors).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        pushPart(parts, `${key}: ${value.join("، ")}`);
      } else {
        pushPart(parts, `${key}: ${value}`);
      }
    });
  }

  if (typeof data.details === "string") {
    pushPart(parts, data.details);
  } else {
    collectNestedMessages(parts, data.details);
  }

  const nestedText = parts.join(" ").toLowerCase();
  if (
    nestedText.includes("missing or invalid authorization") ||
    nestedText.includes("bosta fulfillment api returned 401")
  ) {
    pushPart(
      parts,
      "مفتاح Bosta API غير مضبوط أو غير صالح على السيرفر — راجعي إعدادات الـ backend (Environment Variables).",
    );
  } else if (
    isBostaProxyError(data) &&
    (nestedText.includes("invalid or expired token") ||
      nestedText.includes("invalid token") ||
      nestedText.includes("unauthorized"))
  ) {
    pushPart(
      parts,
      "توكن Bosta API منتهي أو غير صالح — حدّثي المفتاح من لوحة Bosta ثم ضبطيه في Render (Environment Variables) وأعيدي deploy.",
    );
  }

  const status = error?.response?.status;
  if (parts.length === 0 && status) {
    return `${fallback} (${status})`;
  }

  return parts.length > 0 ? parts.join("\n") : fallback;
}
