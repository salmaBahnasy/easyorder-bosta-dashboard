import { useEffect, useMemo, useState } from "react";
import { getOrdersStats } from "../api/ordersApi";

function MetricCard({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>{title}</p>
      <p style={{ margin: "8px 0 0", fontWeight: 700, fontSize: 24 }}>{value}</p>
    </div>
  );
}

function BarsChart({ title, items, color = "#3b82f6", suffix = "" }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 14 }}>{title}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const val = Number(item.value) || 0;
          const width = (val / maxValue) * 100;
          return (
            <div key={item.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  fontSize: 14,
                }}
              >
                <span>{item.label}</span>
                <strong>
                  {val}
                  {suffix}
                </strong>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 10,
                  background: "#eef2f7",
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    width: `${width}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        setLoading(true);
        setError("");
        const response = await getOrdersStats();
        const data = response?.stats ?? response?.data?.stats ?? response?.data ?? response;
        if (!cancelled) {
          setStats(data ?? {});
        }
      } catch (e) {
        console.log(e);
        if (!cancelled) {
          setError("تعذر تحميل إحصائيات الطلبات");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusChartItems = useMemo(
    () => [
      { key: "new", label: "جديد", value: stats?.newOrders ?? 0 },
      { key: "confirmed", label: "تم التأكيد", value: stats?.confirmedOrders ?? 0 },
      { key: "shipped", label: "تم الشحن", value: stats?.shippedOrders ?? 0 },
      { key: "canceled", label: "لاغي", value: stats?.canceledOrders ?? 0 },
      { key: "noReply", label: "لا يرد", value: stats?.noReplyOrders ?? 0 },
    ],
    [stats]
  );

  const valueChartItems = useMemo(
    () => [
      { key: "revenue", label: "إجمالي الإيراد", value: stats?.totalRevenue ?? 0 },
      {
        key: "avgValue",
        label: "متوسط قيمة الطلب",
        value: stats?.averageOrderValue ?? 0,
      },
    ],
    [stats]
  );

  return (
    <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>إحصائيات الطلبات</h1>

      {loading ? (
        <p>جاري تحميل الإحصائيات...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
              marginBottom: 16,
            }}
          >
            <MetricCard title="إجمالي الطلبات" value={stats?.totalOrders ?? 0} />
            <MetricCard title="الطلبات الجديدة" value={stats?.newOrders ?? 0} />
            <MetricCard title="إجمالي الإيراد" value={`${stats?.totalRevenue ?? 0} ج`} />
            <MetricCard
              title="متوسط قيمة الطلب"
              value={`${stats?.averageOrderValue ?? 0} ج`}
            />
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <BarsChart title="Chart حالات الطلبات" items={statusChartItems} color="#2563eb" />
            <BarsChart title="Chart القيم المالية" items={valueChartItems} color="#16a34a" />
          </div>
        </>
      )}
    </div>
  );
}
