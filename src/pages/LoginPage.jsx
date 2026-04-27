import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginSenior } from "../api/ordersApi";
import { isTokenValid } from "../utils/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("من فضلك أدخلي البريد الإلكتروني وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      const result = await loginSenior({ email, password });
      const token = result?.token;
      const employee = result?.data;

      if (!token || !isTokenValid(token)) {
        setError("لم يتم استلام توكن صالح من الخادم");
        return;
      }

      localStorage.setItem("easyorder_token", token);
      if (employee) {
        localStorage.setItem("easyorder_user", JSON.stringify(employee));
      }

      navigate("/");
    } catch (err) {
      console.log(err);
      const msg = err?.response?.data?.message ?? "فشل تسجيل الدخول";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f3f4f6",
        padding: 16,
        direction: "rtl",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 28 }}>تسجيل الدخول</h1>
        <p style={{ marginTop: 0, marginBottom: 18, color: "#64748b" }}>
          ادخلي بياناتك للوصول إلى لوحة الطلبات
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            البريد الإلكتروني
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </label>

          {error ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "جاري تسجيل الدخول..." : "دخول"}
          </button>
        </form>

       
      </div>
    </div>
  );
}
