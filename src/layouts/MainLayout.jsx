import { NavLink, Outlet } from "react-router-dom";

const linkStyle = {
  display: "block",
  padding: "12px 16px",
  color: "#e8eaed",
  textDecoration: "none",
  borderRadius: 8,
  marginBottom: 4,
};

export default function MainLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        direction: "rtl",
        fontFamily: "Arial, sans-serif",
        background: "#f3f4f6",
      }}
    >
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "#1e293b",
          color: "#fff",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24, padding: "0 8px" }}>
          EasyOrder
        </div>
        <nav style={{ display: "flex", flexDirection: "column" }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              ...linkStyle,
              background: isActive ? "#334155" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            الرئيسية
          </NavLink>
          <NavLink
            to="/orders"
            style={({ isActive }) => ({
              ...linkStyle,
              background: isActive ? "#334155" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            الطلبات
          </NavLink>
          <NavLink
            to="/orders/stats"
            style={({ isActive }) => ({
              ...linkStyle,
              background: isActive ? "#334155" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            إحصائيات الطلبات
          </NavLink>
          <NavLink
            to="/products"
            style={({ isActive }) => ({
              ...linkStyle,
              background: isActive ? "#334155" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            منتجات 
          </NavLink>
          <NavLink
            to="/employees"
            style={({ isActive }) => ({
              ...linkStyle,
              background: isActive ? "#334155" : "transparent",
              fontWeight: isActive ? 600 : 400,
            })}
          >
            الموظفين
          </NavLink>
        </nav>
      </aside>
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
