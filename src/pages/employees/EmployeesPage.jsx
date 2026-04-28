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
  role: "junior",
};

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
    setEditingId(employee.id);
    setForm({
      name: employee.name ?? "",
      email: employee.email ?? "",
      password: "",
      role: employee.role ?? "junior",
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
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
        };
        if (form.password.trim()) payload.password = form.password;
        await updateEmployee(editingId, payload);
      } else {
        await createEmployee({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
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
          الدور
          <select
            className="employees-page__input"
            value={form.role}
            onChange={(e) => setField("role", e.target.value)}
          >
            <option value="junior">junior</option>
            <option value="senior">senior</option>
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
                  <th>الدور</th>
                  {/* <th>تاريخ الإنشاء</th> */}
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
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
                          employee.role === "senior"
                            ? "employees-page__role-badge--senior"
                            : "employees-page__role-badge--junior"
                        }`}
                      >
                        {employee.role ?? "—"}
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
                          onClick={() => handleDelete(employee.id)}
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
