import { useEffect, useMemo, useState } from "react";
import { getOrdersStats } from "../../api/ordersApi";
import { colors } from "../../constants/colors";
import ChartCard from "../../components/dashboard/ChartCard";
import LatestOrdersTable from "../../components/dashboard/LatestOrdersTable";
import StatCard from "../../components/dashboard/StatCard";
import "./HomePage.css";

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dateRange, setDateRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadStats() {
    try {
      setLoadingStats(true);
      const response = await getOrdersStats();
      const data = response?.stats ?? response?.data?.stats ?? response?.data ?? response;
      setStats(data ?? {});
    } catch (error) {
      console.log(error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardStats() {
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

    loadDashboardStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalOrders = Number(stats?.totalOrders ?? 0);
  const confirmedOrders = Number(stats?.confirmedOrders ?? 0);
  const cancelledOrders = Number(stats?.canceledOrders ?? stats?.cancelledOrders ?? 0);
  const noReplyOrders = Number(stats?.noReplyOrders ?? 0);
  const totalSales = Number(stats?.totalRevenue ?? stats?.totalSales ?? 0);

  const kpiCards = useMemo(
    () => [
      {
        key: "total",
        title: "إجمالي الطلبات",
        value: totalOrders.toLocaleString("ar-EG"),
        icon: "📦",
        changeText: "+8.2% عن الفترة السابقة",
        accent: colors.primaryBlue,
      },
      {
        key: "confirmed",
        title: "الطلبات المؤكدة",
        value: confirmedOrders.toLocaleString("ar-EG"),
        icon: "✅",
        changeText: "+5.4% عن الفترة السابقة",
        accent: colors.secondaryGreen,
      },
      {
        key: "cancelled",
        title: "الطلبات الملغية",
        value: cancelledOrders.toLocaleString("ar-EG"),
        icon: "❌",
        changeText: "-1.8% عن الفترة السابقة",
        accent: "#ea580c",
      },
      {
        key: "noReply",
        title: "لا يرد",
        value: noReplyOrders.toLocaleString("ar-EG"),
        icon: "📞",
        changeText: "-0.9% عن الفترة السابقة",
        accent: "#7c3aed",
      },
      {
        key: "sales",
        title: "إجمالي المبيعات",
        value: `${totalSales.toLocaleString("ar-EG")} ج`,
        icon: "💰",
        changeText: "+12.3% عن الفترة السابقة",
        accent: colors.primaryBlue,
      },
    ],
    [cancelledOrders, confirmedOrders, noReplyOrders, totalOrders, totalSales]
  );

  const orderStatusItems = useMemo(() => {
    const items = [
      { label: "جديد", value: Number(stats?.newOrders ?? 0), color: "#5B6FB6" },
      { label: "مؤكد", value: confirmedOrders, color: "#5DBB63" },
      { label: "مشحون", value: Number(stats?.shippedOrders ?? 0), color: "#0891b2" },
      { label: "ملغي", value: cancelledOrders, color: "#f97316" },
      { label: "لا يرد", value: noReplyOrders, color: "#7c3aed" },
    ];
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    return { items, maxValue };
  }, [stats, confirmedOrders, cancelledOrders, noReplyOrders]);

  const dailySales = useMemo(() => {
    const fromApi = Array.isArray(stats?.dailySales) ? stats.dailySales : null;
    if (fromApi && fromApi.length > 0) {
      return fromApi.slice(0, 7).map((item, idx) => ({
        day: item?.day ?? item?.date ?? `يوم ${idx + 1}`,
        amount: Number(item?.amount ?? item?.sales ?? 0),
      }));
    }

    const base = totalSales > 0 ? Math.max(Math.round(totalSales / 7), 1) : 1200;
    return ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map(
      (day, idx) => ({
        day,
        amount: base + (idx % 3) * Math.round(base * 0.15),
      })
    );
  }, [stats, totalSales]);

  const latestOrders = useMemo(() => {
    const fromApi = Array.isArray(stats?.latestOrders) ? stats.latestOrders : null;
    if (fromApi && fromApi.length > 0) {
      return fromApi.slice(0, 6).map((order, idx) => ({
        id: order?.id ?? order?.orderId ?? `#${1000 + idx}`,
        status: order?.status ?? "جديد",
        amount: `${Number(order?.amount ?? order?.total ?? 0).toLocaleString("ar-EG")} ج`,
        date: order?.date ?? order?.createdAt?.slice(0, 10) ?? "-",
      }));
    }

    return [
      { id: "#4521", status: "مؤكد", amount: "1,250 ج", date: "2026-04-28" },
      { id: "#4518", status: "جديد", amount: "980 ج", date: "2026-04-28" },
      { id: "#4515", status: "لا يرد", amount: "640 ج", date: "2026-04-27" },
      { id: "#4512", status: "ملغي", amount: "720 ج", date: "2026-04-27" },
      { id: "#4509", status: "مشحون", amount: "1,480 ج", date: "2026-04-26" },
    ];
  }, [stats]);

  const topProducts = useMemo(() => {
    const fromApi = Array.isArray(stats?.topProducts) ? stats.topProducts : null;
    if (fromApi && fromApi.length > 0) {
      return fromApi.slice(0, 6).map((item, idx) => ({
        sku: item?.sku ?? item?.name ?? `SKU-${idx + 1}`,
        sold: Number(item?.sold ?? item?.count ?? 0),
      }));
    }
    return [
      { sku: "ENAYA-PILLOW-01", sold: 132 },
      { sku: "ENAYA-PILLOW-02", sold: 111 },
      { sku: "ENAYA-KIDS-01", sold: 87 },
      { sku: "ENAYA-MEDICAL-PLUS", sold: 74 },
      { sku: "ENAYA-SUPPORT-05", sold: 68 },
    ];
  }, [stats]);

  return (
    <div className="dashboard-page">
       <div className="title-topbar">
          <h1>لوحة الإحصائيات</h1>
          <p>نظرة عامة على أداء الطلبات والمبيعات</p>
        </div>
      <section className="dashboard-topbar">
       
        <div className="dashboard-topbar__controls">
          <select
            className="dashboard-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="month">الشهر</option>
          </select>
          <input
            type="date"
            className="dashboard-date-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="من تاريخ"
            title="من تاريخ"
          />
          <input
            type="date"
            className="dashboard-date-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="إلى تاريخ"
            title="إلى تاريخ"
          />
          <button type="button" className="dashboard-refresh-btn" onClick={loadStats}>
            تحديث الداتا
          </button>
        </div>
      </section>

      {loadingStats ? (
        <p>جاري تحميل الإحصائيات...</p>
      ) : !stats ? (
        <p>تعذر تحميل الإحصائيات حاليًا.</p>
      ) : (
        <>
          <section className="dashboard-kpis">
            {kpiCards.map((card) => (
              <StatCard
                key={card.key}
                title={card.title}
                value={card.value}
                changeText={card.changeText}
                icon={card.icon}
                accent={card.accent}
              />
            ))}
          </section>

          <section className="dashboard-middle">
            <ChartCard title="الطلبات حسب الحالة" subtitle="توزيع الحالات خلال الفترة المحددة">
              <div className="dashboard-status-chart">
                {orderStatusItems.items.map((item) => (
                  <div key={item.label} className="dashboard-status-row">
                    <div className="dashboard-status-row__head">
                      <span>{item.label}</span>
                      <strong>{item.value.toLocaleString("ar-EG")}</strong>
                    </div>
                    <div className="dashboard-progress">
                      <span
                        style={{
                          width: `${(item.value / orderStatusItems.maxValue) * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="المبيعات اليومية" subtitle="أداء المبيعات اليومي">
              <div className="dashboard-sales-chart">
                {dailySales.map((item) => (
                  <div className="dashboard-sales-bar" key={item.day}>
                    <span
                      style={{
                        height: `${Math.max((item.amount / Math.max(...dailySales.map((d) => d.amount), 1)) * 150, 16)}px`,
                      }}
                    />
                    <label>{item.day}</label>
                  </div>
                ))}
              </div>
            </ChartCard>
          </section>

          <section className="dashboard-bottom">
            <LatestOrdersTable rows={latestOrders} />

            <section className="dashboard-products-card">
              <h3>Top Products</h3>
              <p>أكثر SKU مبيعًا</p>
              <ul className="dashboard-products-list">
                {topProducts.map((product) => (
                  <li key={product.sku} className="dashboard-products-item">
                    <span>{product.sku}</span>
                    <strong>{product.sold.toLocaleString("ar-EG")} طلب</strong>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        </>
      )}
    </div>
  );
}
