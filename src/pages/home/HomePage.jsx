import { useEffect, useMemo, useState } from "react";
import { getEmployees, getOrdersStats, resolveEmployeeOrderFilterParams } from "../../api/ordersApi";
import { colors } from "../../constants/colors";
import ChartCard from "../../components/dashboard/ChartCard";
import LatestOrdersTable from "../../components/dashboard/LatestOrdersTable";
import StatCard from "../../components/dashboard/StatCard";
import "./HomePage.css";

function normalizeStatsPayload(response) {
  return response?.stats ?? response?.data?.stats ?? response?.data ?? response;
}

function isoUtcStartOfDay(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const day = dateStr.slice(0, 10);
  return `${day}T00:00:00.000Z`;
}

function isoUtcEndOfDay(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const day = dateStr.slice(0, 10);
  return `${day}T23:59:59.999Z`;
}

function buildStatsQueryParams({ dateRange, dateFrom, dateTo, employeeId, employees }) {
  const params = {};
  Object.assign(params, resolveEmployeeOrderFilterParams(employees, employeeId));

  if (dateFrom && dateTo) {
    params.from = isoUtcStartOfDay(dateFrom);
    params.to = isoUtcEndOfDay(dateTo);
    return params;
  }

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayEnd = new Date(Date.UTC(y, m, d, 23, 59, 59, 999)).toISOString();

  if (dateRange === "today") {
    params.from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString();
    params.to = todayEnd;
  } else if (dateRange === "7d") {
    params.from = new Date(Date.UTC(y, m, d - 6, 0, 0, 0, 0)).toISOString();
    params.to = todayEnd;
  } else if (dateRange === "month") {
    params.from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString();
    params.to = todayEnd;
  }

  return params;
}

function pickStat(stats, ...keys) {
  if (!stats) return 0;
  for (const k of keys) {
    const v = stats[k];
    if (v != null && v !== "") return Number(v);
  }
  return 0;
}

async function fetchDashboardStats(filters) {
  const query = buildStatsQueryParams(filters);
  const response = await getOrdersStats(query);
  return normalizeStatsPayload(response) ?? {};
}

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dateRange, setDateRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        const result = await getEmployees();
        const list = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.employees)
            ? result.employees
            : [];
        if (!cancelled) setEmployees(list);
      } catch (error) {
        console.log(error);
        if (!cancelled) setEmployees([]);
      }
    }

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingStats(true);
        const data = await fetchDashboardStats({
          dateRange,
          dateFrom,
          dateTo,
          employeeId: employeeFilter,
          employees,
        });
        if (!cancelled) setStats(data);
      } catch (error) {
        console.log(error);
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange, dateFrom, dateTo, employeeFilter, employees]);

  async function handleRefreshStats() {
    try {
      setLoadingStats(true);
      const data = await fetchDashboardStats({
        dateRange,
        dateFrom,
        dateTo,
        employeeId: employeeFilter,
        employees,
      });
      setStats(data);
    } catch (error) {
      console.log(error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }

  const totalOrders = pickStat(stats, "totalOrders", "total_orders");
  const confirmedCount = pickStat(
    stats,
    "Confirmed",
    "confirmed",
    "confirmedOrders",
  );
  const shippedCount = pickStat(stats, "Shipped", "shipped", "shippedOrders");
  const canceledCount = pickStat(
    stats,
    "canceled",
    "cancelled",
    "cancelledOrders",
    "canceledOrders",
  );
  const noReplayCount = pickStat(
    stats,
    "no_replay",
    "noReplay",
    "noReplyOrders",
  );
  const followUpCount = pickStat(
    stats,
    "follow_up",
    "followUp",
    "followUpOrders",
  );
  const repeaterCount = pickStat(stats, "repeater", "repeaterOrders");
  const totalSales = pickStat(stats, "totalRevenue", "totalSales", "total_sales");

  const periodHint = "حسب الفترة والفلتر الحالي";

  const kpiCards = useMemo(
    () => [
      {
        key: "total",
        title: "إجمالي الطلبات",
        value: totalOrders.toLocaleString("ar-EG"),
        icon: "📦",
        changeText: periodHint,
        accent: colors.primaryBlue,
      },
      {
        key: "confirmed",
        title: "مؤكد",
        value: confirmedCount.toLocaleString("ar-EG"),
        icon: "✅",
        changeText: periodHint,
        accent: colors.secondaryGreen,
      },
      {
        key: "shipped",
        title: "مشحون",
        value: shippedCount.toLocaleString("ar-EG"),
        icon: "🚚",
        changeText: periodHint,
        accent: "#0891b2",
      },
      {
        key: "canceled",
        title: "ملغي",
        value: canceledCount.toLocaleString("ar-EG"),
        icon: "❌",
        changeText: periodHint,
        accent: "#ea580c",
      },
      {
        key: "no_replay",
        title: "لا يرد",
        value: noReplayCount.toLocaleString("ar-EG"),
        icon: "📵",
        changeText: periodHint,
        accent: "#7c3aed",
      },
      {
        key: "follow_up",
        title: "متابعة",
        value: followUpCount.toLocaleString("ar-EG"),
        icon: "📋",
        changeText: periodHint,
        accent: "#ca8a04",
      },
      {
        key: "repeater",
        title: "مكرر",
        value: repeaterCount.toLocaleString("ar-EG"),
        icon: "🔁",
        changeText: periodHint,
        accent: "#6366f1",
      },
      {
        key: "sales",
        title: "إجمالي المبيعات",
        value: `${totalSales.toLocaleString("ar-EG")} ج`,
        icon: "💰",
        changeText: periodHint,
        accent: colors.primaryBlue,
      },
    ],
    [
      canceledCount,
      confirmedCount,
      followUpCount,
      noReplayCount,
      repeaterCount,
      shippedCount,
      totalOrders,
      totalSales,
    ],
  );

  const orderStatusItems = useMemo(() => {
    const items = [
      { label: "مؤكد", value: confirmedCount, color: "#5DBB63" },
      { label: "مشحون", value: shippedCount, color: "#0891b2" },
      { label: "ملغي", value: canceledCount, color: "#f97316" },
      { label: "لا يرد", value: noReplayCount, color: "#7c3aed" },
      { label: "متابعة", value: followUpCount, color: "#ca8a04" },
      { label: "مكرر", value: repeaterCount, color: "#6366f1" },
    ];
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    return { items, maxValue };
  }, [
    canceledCount,
    confirmedCount,
    followUpCount,
    noReplayCount,
    repeaterCount,
    shippedCount,
  ]);

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
            className="dashboard-select dashboard-select--employee"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            aria-label="تصفية حسب الموظف"
            title="تصفية حسب الموظف"
          >
            <option value="">كل الموظفين</option>
            {employees.map((emp) => (
              <option key={emp.id} value={String(emp.id)}>
                {emp.name ?? emp.email ?? `موظف #${emp.id}`}
              </option>
            ))}
          </select>
          {/* <select
            className="dashboard-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="month">الشهر</option>
          </select> */}
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
          <button type="button" className="dashboard-refresh-btn" onClick={handleRefreshStats}>
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
            <ChartCard
              title="الطلبات حسب الحالة"
              subtitle="مؤكد، مشحون، ملغي، لا يرد، متابعة، مكرر — حسب الفترة والفلتر"
            >
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
