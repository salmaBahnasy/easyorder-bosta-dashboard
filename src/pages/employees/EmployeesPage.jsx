import { useEffect, useRef, useState } from "react";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "../../api/ordersApi";
import "./EmployeesPage.css";

const initialForm = {
  name: "",
  email: "",
  password: "",
  is_active: false,
  employeeRole: "employee",
};

const EMPLOYEE_ROLE_OPTIONS = [
  { value: "admin", label: "مسؤول (admin)" },
  { value: "employee", label: "موظف (employee)" },
];

function normalizeEmployeeRole(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "admin" ? "admin" : "employee";
}

/**
 * الخادم قد يضع الصلاحية في `role` (admin|employee) أو في employeeRole.
 * حقل `role` قد يكون أيضاً senior|junior لحسابات قديمة.
 */
function getPrivilegeFromEmployee(emp) {
  const r = String(emp?.role ?? "").trim().toLowerCase();
  if (r === "admin" || r === "employee") {
    return normalizeEmployeeRole(r);
  }
  return normalizeEmployeeRole(emp?.employeeRole ?? emp?.employee_role);
}

/** مفعل / غير مفعل — يفضّل `is_active` من الـ API مع دعم سجلات قديمة. */
function getIsActiveFromEmployee(emp) {
  if (emp?.is_active === true || emp?.isActive === true) return true;
  if (emp?.is_active === false || emp?.isActive === false) return false;
  const jr = String(emp?.jobRole ?? "").trim().toLowerCase();
  if (jr === "senior") return true;
  if (jr === "junior") return false;
  const r = String(emp?.role ?? "").trim().toLowerCase();
  if (r === "senior") return true;
  if (r === "junior") return false;
  return false;
}

function employeeRoleUiLabel(value) {
  return normalizeEmployeeRole(value) === "admin" ? "مسؤول" : "موظف";
}

function buildEmployeeSavePayload(form) {
  const privilege = normalizeEmployeeRole(form.employeeRole);
  return {
    name: form.name,
    email: form.email,
    role: privilege,
    employeeRole: privilege,
    is_active: Boolean(form.is_active),
  };
}

export default function EmployeesPage() {
  const formCardRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  async function loadEmployees() {
    try {
      setLoading(true);
      const result = await getEmployees();
      const list = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.employees)
          ? result.employees
          : [];
      setEmployees(list);
    } catch (error) {
      console.log(error);
      alert("تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(employee) {
    setEditingId(employee.id ?? employee._id);
    setForm({
      name: employee.name ?? "",
      email: employee.email ?? "",
      password: "",
      is_active: getIsActiveFromEmployee(employee),
      employeeRole: getPrivilegeFromEmployee(employee),
    });
  }

  function handleAddEmployeeClick() {
    resetForm();
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getInitials(name) {
    const words = String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return "؟";
    if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
    return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      alert("الاسم والإيميل مطلوبين");
      return;
    }
    if (!editingId && !form.password.trim()) {
      alert("كلمة المرور مطلوبة عند إضافة موظف");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const payload = buildEmployeeSavePayload(form);
        if (form.password.trim()) payload.password = form.password;
        await updateEmployee(editingId, payload);
      } else {
        await createEmployee({
          name: form.name,
          email: form.email,
          password: form.password,
          is_active: form.is_active,
          employeeRole: form.employeeRole,
        });
      }
      resetForm();
      await loadEmployees();
    } catch (error) {
      console.log(error);
      alert("حصل خطأ أثناء حفظ بيانات الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employeeId) {
    const ok = window.confirm("هل تريدين حذف هذا الموظف؟");
    if (!ok) return;

    try {
      await deleteEmployee(employeeId);
      await loadEmployees();
    } catch (error) {
      console.log(error);
      alert("حصل خطأ أثناء حذف الموظف");
    }
  }

  return (
    <div className="employees-page">
      <section className="employees-page__header">
        <div>
          <h1>إدارة الموظفين</h1>
          <p>إضافة وتعديل بيانات الموظفين ومتابعة الأدوار داخل النظام.</p>
        </div>
        <button
          type="button"
          className="employees-page__add-btn"
          onClick={handleAddEmployeeClick}
        >
          + إضافة موظف
        </button>
      </section>

      <form
        ref={formCardRef}
        onSubmit={handleSubmit}
        className="employees-page__form-card"
      >
        <label className="employees-page__field">
          الاسم
          <input
            className="employees-page__input"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <label className="employees-page__field">
          البريد الإلكتروني
          <input
            className="employees-page__input"
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            required
          />
        </label>

        <label className="employees-page__field">
          كلمة المرور {editingId ? "(اختياري للتعديل)" : ""}
          <input
            className="employees-page__input"
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            required={!editingId}
          />
        </label>

        <label className="employees-page__field">
          صلاحية الموظف
          <select
            className="employees-page__input"
            value={form.employeeRole}
            onChange={(e) => setField("employeeRole", e.target.value)}
          >
            {EMPLOYEE_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="employees-page__field">
          الحالة
          <select
            className="employees-page__input"
            value={form.is_active ? "true" : "false"}
            onChange={(e) => setField("is_active", e.target.value === "true")}
          >
            <option value="true">مفعل</option>
            <option value="false">غير مفعل</option>
          </select>
        </label>

        <div className="employees-page__form-actions">
          <button type="submit" disabled={saving} className="employees-page__btn employees-page__btn--primary">
            {saving ? "جاري الحفظ..." : editingId ? "تحديث الموظف" : "إضافة موظف"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="employees-page__btn employees-page__btn--outline"
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>
      </form>

      <div className="employees-page__table-card">
        {loading ? (
          <p className="employees-page__loading">جاري تحميل الموظفين...</p>
        ) : (
          <div className="employees-page__table-wrap">
            <table className="employees-page__table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الإيميل</th>
                  <th>الحالة</th>
                  <th>الصلاحية</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id ?? employee._id}>
                    <td>
                      <div className="employees-page__name-cell">
                        <span className="employees-page__avatar">
                          {getInitials(employee.name)}
                        </span>
                        <span>{employee.name ?? "—"}</span>
                      </div>
                    </td>
                    <td>{employee.email ?? "—"}</td>
                    <td>
                      <span
                        className={`employees-page__role-badge ${
                          getIsActiveFromEmployee(employee)
                            ? "employees-page__role-badge--senior"
                            : "employees-page__role-badge--junior"
                        }`}
                      >
                        {getIsActiveFromEmployee(employee) ? "مفعل" : "غير مفعل"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`employees-page__role-badge ${
                          getPrivilegeFromEmployee(employee) === "admin"
                            ? "employees-page__role-badge--admin"
                            : "employees-page__role-badge--employee"
                        }`}
                      >
                        {employeeRoleUiLabel(getPrivilegeFromEmployee(employee))}
                      </span>
                    </td>
                    {/* <td>{employee.created_at ?? "—"}</td> */}
                    <td>
                      <div className="employees-page__table-actions">
                        <button
                          type="button"
                          onClick={() => startEdit(employee)}
                          className="employees-page__icon-btn"
                          title="تعديل"
                          aria-label="تعديل"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(employee.id ?? employee._id)}
                          className="employees-page__icon-btn employees-page__icon-btn--danger"
                          title="حذف"
                          aria-label="حذف"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="employees-page__empty">
                      لا يوجد موظفين
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
