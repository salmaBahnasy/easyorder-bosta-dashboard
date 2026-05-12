/**
 * User snapshot from login (`easyorder_user` in localStorage).
 * Used for audit fields on order create / update / status APIs.
 */
export function getOrderActorFromStorage() {
  try {
    const raw = localStorage.getItem("easyorder_user");
    if (!raw) {
      return { displayName: "المستخدم الحالي", email: null, id: null };
    }
    const u = JSON.parse(raw);
    const displayName =
      String(u?.name ?? u?.full_name ?? u?.email ?? "").trim() || "المستخدم الحالي";
    const email = u?.email != null ? String(u.email).trim() : null;
    const id = u?.id ?? u?._id ?? u?.employee_id ?? null;
    const idNorm = id != null && String(id).trim() !== "" ? id : null;
    return {
      displayName,
      email: email || null,
      id: idNorm,
    };
  } catch {
    return { displayName: "المستخدم الحالي", email: null, id: null };
  }
}

/** Display name for UI (e.g. status history preview). */
export function getActiveUserDisplayName() {
  return getOrderActorFromStorage().displayName;
}

/**
 * Best-effort display name for "who" on order objects or timeline rows (backend field names vary).
 * Returns null if nothing recognizable.
 */
export function resolveActorDisplayName(record) {
  if (!record || typeof record !== "object") return null;

  const flat = [
    record.userName,
    record.user_name,
    record.updatedByName,
    record.updated_by_name,
    record.createdByName,
    record.created_by_name,
    record.employeeName,
    record.employee_name,
    record.salesName,
    record.sales_name,
    record.assignedTo,
    record.assigned_to,
    record.performed_by_name,
    record.performedBy,
    record.modified_by_name,
    record.actor_name,
    record.actor,
    record.changedBy,
    record.changed_by,
    record.updatedBy,
    record.updated_by,
    record.createdBy,
    record.created_by,
  ];

  for (const v of flat) {
    if (v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  const emp = record.employee;
  if (emp && typeof emp === "object") {
    const n = emp.name ?? emp.full_name ?? emp.email ?? emp.username;
    if (n != null && String(n).trim() !== "") return String(n).trim();
  }
  if (typeof emp === "string" && emp.trim()) return emp.trim();

  const usr = record.user;
  if (usr && typeof usr === "object") {
    const n = usr.name ?? usr.full_name ?? usr.email ?? usr.username;
    if (n != null && String(n).trim() !== "") return String(n).trim();
  }
  if (typeof usr === "string" && usr.trim()) return usr.trim();

  const meta = record.meta ?? record.metadata;
  if (meta && typeof meta === "object") {
    const n =
      meta.updated_by_name ??
      meta.user_name ??
      meta.actor_name ??
      meta.performed_by;
    if (n != null && String(n).trim() !== "") return String(n).trim();
  }

  return null;
}

/**
 * Extra fields sent with every order mutation so the backend can log who acted.
 * Spread after the main payload so these values always reflect the logged-in user.
 */
export function getOrderAuditFields() {
  const { displayName, email, id } = getOrderActorFromStorage();
  const fields = {
    updated_by_name: displayName,
    last_modified_by_name: displayName,
    created_by_name: displayName,
    modified_by_name: displayName,
  };
  if (email) {
    fields.updated_by_email = email;
    fields.user_email = email;
  }
  if (id != null) {
    fields.updated_by_employee_id = id;
    fields.modifier_employee_id = id;
  }
  return fields;
}
