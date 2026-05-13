const TOKEN_STORAGE_KEY = "easyorder_token";
const EMPLOYEE_ROLE_STORAGE_KEY = "easyorder_employee_role";

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

/** Normalizes API / JWT privilege to `admin` | `employee` (لا يخلط مع `role` الوظيفي junior/senior). */
export function normalizeStoredEmployeeRole(value) {
  if (value === true) return "admin";
  if (value === false) return "employee";
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return "employee";
  if (
    s === "admin" ||
    s === "administrator" ||
    s === "super_admin" ||
    s === "superadmin" ||
    s === "owner"
  ) {
    return "admin";
  }
  return "employee";
}

/** يقرأ صلاحية المسؤول من كائن مستخدم/استجابة (وليس حقل role الوظيفي). */
export function pickPrivilegeRoleFromUserLike(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.isAdmin === true || obj.is_admin === true) return "admin";
  const r = String(obj.role ?? "").trim().toLowerCase();
  if (r === "admin" || r === "employee") {
    return normalizeStoredEmployeeRole(r);
  }
  const raw =
    obj.employeeRole ??
    obj.employee_role ??
    obj.employeeType ??
    obj.employee_type ??
    obj.privilegeRole ??
    obj.privilege_role;
  if (raw == null || String(raw).trim() === "") return null;
  return normalizeStoredEmployeeRole(raw);
}

function privilegeRoleFromJwtToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return null;
  const fromPick = pickPrivilegeRoleFromUserLike(payload);
  if (fromPick) return fromPick;
  const combined =
    payload.employeeRole ??
    payload.employee_role ??
    payload.role ??
    payload.userRole ??
    payload.user_role;
  if (combined == null || String(combined).trim() === "") return null;
  return normalizeStoredEmployeeRole(combined);
}

/** بعد تسجيل الدخول: يدمج كائن المستخدم والتوكن لاستنتاج الصلاحية. */
export function resolvePrivilegeRoleAfterLogin(employee, token) {
  const fromUser = pickPrivilegeRoleFromUserLike(employee);
  if (fromUser === "admin") return "admin";
  const fromJwt = privilegeRoleFromJwtToken(token);
  if (fromJwt === "admin") return "admin";
  if (fromUser) return fromUser;
  if (fromJwt) return fromJwt;
  return "employee";
}

/**
 * صلاحية العرض في الواجهة: إن وُجدت أي مصادر تصف المستخدم كـ admin نعتبره admin
 * (JWT أو easyorder_user قد يحملان القيمة حتى لو easyorder_employee_role قديم).
 */
export function getStoredEmployeeRole() {
  const candidates = [];

  const direct = localStorage.getItem(EMPLOYEE_ROLE_STORAGE_KEY);
  if (direct != null && String(direct).trim() !== "") {
    candidates.push(normalizeStoredEmployeeRole(direct));
  }

  try {
    const raw = localStorage.getItem("easyorder_user");
    if (raw) {
      const u = JSON.parse(raw);
      const fromUser = pickPrivilegeRoleFromUserLike(u);
      if (fromUser) candidates.push(fromUser);
    }
  } catch {
    // ignore
  }

  const token = getStoredToken();
  const fromJwt = privilegeRoleFromJwtToken(token);
  if (fromJwt) candidates.push(fromJwt);

  if (candidates.some((r) => r === "admin")) return "admin";
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

export function setStoredEmployeeRole(role) {
  localStorage.setItem(EMPLOYEE_ROLE_STORAGE_KEY, normalizeStoredEmployeeRole(role));
}

/** المستخدم الحالي مسؤول (صلاحية إدارة الموظفين وفلتر «كل الموظفين»). */
export function isStoredUserAdmin() {
  return getStoredEmployeeRole() === "admin";
}

/** صف واحد للموظف الحالي — لقوائم الفلترة عندما لا يكون المستخدم admin. */
export function getSelfEmployeeRowsForFilter() {
  try {
    const raw = localStorage.getItem("easyorder_user");
    if (!raw) return [];
    const u = JSON.parse(raw);
    const id = u?.id ?? u?._id ?? u?.employeeId;
    if (id == null || String(id).trim() === "") return [];
    const name = String(u?.name ?? u?.full_name ?? u?.email ?? "موظف").trim();
    return [
      {
        id: String(id).trim(),
        name: name || "موظف",
        email: u?.email ?? "",
      },
    ];
  } catch {
    return [];
  }
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem("easyorder_user");
  localStorage.removeItem(EMPLOYEE_ROLE_STORAGE_KEY);
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
