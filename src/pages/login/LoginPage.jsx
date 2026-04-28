import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginSenior } from "../../api/ordersApi";
import { isTokenValid } from "../../utils/auth";
import { colors } from "../../constants/colors";
import { logo, rightbg } from "../../assets/images";
import "./LoginPage.css";

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

            {/* <div className="login-page__assist-row">
              <label className="login-page__remember">
                <input type="checkbox" />
                تذكرني
              </label>
              <Link to="/login" className="login-page__forgot-link">
                نسيت كلمة المرور؟
              </Link>
            </div> */}

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
