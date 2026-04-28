import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logo } from "../assets/images";
import { clearAuthStorage } from "../utils/auth";
import "./MainLayout.css";

export default function MainLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthStorage();
    navigate("/login", { replace: true });
  }

  return (
    <div className="main-layout">
      <aside className="main-layout__sidebar">
        <div className="main-layout__logo-wrap">
          <img src={logo} alt="Enaya" className="main-layout__logo" />
        </div>
        <nav className="main-layout__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `main-layout__nav-link ${isActive ? "main-layout__nav-link--active" : ""}`
            }
          >
            <span className="main-layout__icon">🏠</span>
            الرئيسية
          </NavLink>
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `main-layout__nav-link ${isActive ? "main-layout__nav-link--active" : ""}`
            }
          >
            <span className="main-layout__icon">📦</span>
            الطلبات
          </NavLink>
          <NavLink
            to="/orders/stats"
            className={({ isActive }) =>
              `main-layout__nav-link ${isActive ? "main-layout__nav-link--active" : ""}`
            }
          >
            <span className="main-layout__icon">📊</span>
            إحصائيات الطلبات
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `main-layout__nav-link ${isActive ? "main-layout__nav-link--active" : ""}`
            }
          >
            <span className="main-layout__icon">🧴</span>
            منتجات
          </NavLink>
          <NavLink
            to="/employees"
            className={({ isActive }) =>
              `main-layout__nav-link ${isActive ? "main-layout__nav-link--active" : ""}`
            }
          >
            <span className="main-layout__icon">👥</span>
            الموظفين
          </NavLink>
        </nav>
        <button type="button" onClick={handleLogout} className="main-layout__logout">
          تسجيل الخروج
        </button>
      </aside>
      <main className="main-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
