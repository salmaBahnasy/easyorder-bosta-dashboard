import { useEffect, useState } from "react";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "../api/ordersApi";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "junior",
};

export default function EmployeesPage() {
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
    <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>إدارة الموظفين</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          الاسم
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          البريد الإلكتروني
          <input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          كلمة المرور {editingId ? "(اختياري للتعديل)" : ""}
          <input
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            required={!editingId}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          الدور
          <select value={form.role} onChange={(e) => setField("role", e.target.value)}>
            <option value="junior">junior</option>
            <option value="senior">senior</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
          <button type="submit" disabled={saving}>
            {saving ? "جاري الحفظ..." : editingId ? "تحديث الموظف" : "إضافة موظف"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm}>
              إلغاء التعديل
            </button>
          ) : null}
        </div>
      </form>

      <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8 }}>
        {loading ? (
          <p style={{ padding: 16 }}>جاري تحميل الموظفين...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              border="1"
              cellPadding="10"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الإيميل</th>
                  <th>الدور</th>
                  <th>تاريخ الإنشاء</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name ?? "—"}</td>
                    <td>{employee.email ?? "—"}</td>
                    <td>{employee.role ?? "—"}</td>
                    <td>{employee.created_at ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button type="button" onClick={() => startEdit(employee)}>
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(employee.id)}
                          style={{ background: "#ef4444", color: "#fff", border: "none" }}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 14 }}>
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
