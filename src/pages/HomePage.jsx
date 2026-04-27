import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrdersStats } from "../api/ordersApi";

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        setLoadingStats(true);
        const response = await getOrdersStats();
        const data = response?.stats ?? response?.data?.stats ?? response?.data ?? response;
        if (!cancelled) {
          setStats(data ?? {});
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>لوحة التحكم</h1>
      <p style={{ color: "#475569", lineHeight: 1.6 }}>
        من هنا تقدري تتابعي كل الطلبات من الموقع وتفتحي تفاصيل أي طلب من الـ API.
      </p>
      <ul style={{ paddingRight: 20, lineHeight: 2 }}>
        <li>
          <Link to="/login">تسجيل الدخول</Link>
        </li>
        <li>
          <Link to="/orders">عرض الطلبات من الموقع</Link>
        </li>
        <li>
          <Link to="/orders/stats">عرض إحصائيات الطلبات</Link>
        </li>
        <li>
          <Link to="/employees">إدارة الموظفين</Link>
        </li>
        <li>
          <Link to="/products">المنتجات</Link>
        </li>
      </ul>

      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>ملخص الإحصائيات</h2>
        {loadingStats ? (
          <p>جاري تحميل الإحصائيات...</p>
        ) : !stats ? (
          <p>تعذر تحميل الإحصائيات حاليًا.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
            }}
          >
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: "#64748b" }}>إجمالي الطلبات</p>
              <strong style={{ fontSize: 24 }}>{stats.totalOrders ?? 0}</strong>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: "#64748b" }}>الطلبات الجديدة</p>
              <strong style={{ fontSize: 24 }}>{stats.newOrders ?? 0}</strong>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: "#64748b" }}>الطلبات المؤكدة</p>
              <strong style={{ fontSize: 24 }}>{stats.confirmedOrders ?? 0}</strong>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: "#64748b" }}>الطلبات المشحونة</p>
              <strong style={{ fontSize: 24 }}>{stats.shippedOrders ?? 0}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
