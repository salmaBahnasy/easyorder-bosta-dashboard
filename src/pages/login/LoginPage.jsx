import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginDashboard } from "../../api/ordersApi";
import {
  SELECTED_SYSTEM_STORAGE_KEY,
  appHref,
  isTokenValid,
  resolvePrivilegeRoleAfterLogin,
  setSelectedSystem,
  setStoredEmployeeRole,
} from "../../utils/auth";
import { colors } from "../../constants/colors";
import { logo, rightbg } from "../../assets/images";
import "./LoginPage.css";

function initialLoginSystemTab() {
  const raw = localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY);
  return raw === "salla" ? "salla" : "easyorder";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginSystem, setLoginSystem] = useState(initialLoginSystemTab);
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
      const result = await loginDashboard(loginSystem, { email, password });
      const token = result?.token;
      const employee =
        result?.data ?? result?.employee ?? result?.user ?? null;

      if (!token || !isTokenValid(token)) {
        setError("لم يتم استلام توكن صالح من الخادم");
        return;
      }

      setSelectedSystem(loginSystem);
      localStorage.setItem("easyorder_token", token);
      const privilegeRole = resolvePrivilegeRoleAfterLogin(employee, token);
      setStoredEmployeeRole(privilegeRole);
      if (employee) {
        localStorage.setItem("easyorder_user", JSON.stringify(employee));
      }

      navigate(appHref("dashboard"), { replace: true });
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
      className="login-page"
      style={{
        "--login-primary": colors.primaryBlue,
        "--login-secondary": colors.secondaryGreen,
        "--login-bg": colors.backgroundLight,
        "--login-text": colors.textDark,
        "--login-white": colors.white,
      }}
    >
      <section className="login-page__left" dir="rtl">
        <div className="login-page__card">
          <h1>مرحبا بعودتك</h1>
          <p>سجل الدخول للوصول إلى حسابك</p>

          <div className="login-page__system-picker" role="tablist" aria-label="اختيار النظام">
            <button
              type="button"
              role="tab"
              aria-selected={loginSystem === "easyorder"}
              className={`login-page__system-card ${
                loginSystem === "easyorder" ? "login-page__system-card--active" : ""
              }`}
              onClick={() => setLoginSystem("easyorder")}
            >
              <span className="login-page__system-title">EasyOrder</span>
              <span className="login-page__system-sub">Egypt</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginSystem === "salla"}
              className={`login-page__system-card ${
                loginSystem === "salla" ? "login-page__system-card--active" : ""
              }`}
              onClick={() => setLoginSystem("salla")}
            >
              <span className="login-page__system-title">Salla</span>
              <span className="login-page__system-sub">Saudi Arabia</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-page__form">
            <label className="login-page__label">
              البريد الإلكتروني
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ادخل بريدك الإلكتروني"
                autoComplete="email"
              />
            </label>

            <label className="login-page__label">
              كلمة المرور
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ادخل كلمة المرور"
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="login-page__error">{error}</p> : null}

            <button type="submit" disabled={loading} className="login-page__submit">
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
              <span className="login-page__submit-arrow" aria-hidden="true">
                ←
              </span>
            </button>

            <div className="login-page__divider">*</div>
          </form>

          <p className="login-page__security-note">بياناتك محمية وآمنة</p>
        </div>
        <span className="login-page__left-dot-pattern" aria-hidden="true" />
        <span className="login-page__left-half-circle" aria-hidden="true" />
        <span className="login-page__left-curve" aria-hidden="true" />
      </section>

      <section
        className="login-page__right"
        aria-label="Brand hero"
        style={{ backgroundImage: `url(${rightbg})` }}
      >
        <div className="login-page__overlay" />
        <img src={logo} alt="Enaya logo" className="login-page__logo" />
        <p className="login-page__hero-label">المخدات الطبية رقم #1 في مصر</p>
      </section>
    </div>
  );
}
