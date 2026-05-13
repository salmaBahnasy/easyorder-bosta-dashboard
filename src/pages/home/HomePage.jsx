import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployees,
  getOrdersAnalytics,
  getOrdersStats,
  getProducts,
  resolveEmployeeOrderFilterParams,
} from "../../api/ordersApi";
import {
  firstBucketValue,
  OrdersDonutCard,
  OrdersStatusBarChart,
} from "../../components/dashboard/DashboardCharts";
import LatestOrdersTable from "../../components/dashboard/LatestOrdersTable";
import StatCard from "../../components/dashboard/StatCard";
import "./HomePage.css";
import { getSelfEmployeeRowsForFilter, isStoredUserAdmin } from "../../utils/auth";
import {
  getProductFilterId,
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";

const ORDER_SOURCE_LABELS = {
  store: "المتجر",
  messenger: "ماسنجر",
  whatsapp: "واتساب",
  lost_order: "طلب مفقود",
};

const ORDER_TYPE_LABELS = {
  new: "أوردر جديد",
  replacement: "استبدال",
  return: "مرتجع",
};

const SHIPPING_STATUS_LABELS = {
  in_progress: "قيد التوصيل",
  delivered: "تم التوصيل",
  failed: "فشل التوصيل",
};

const ORDER_STATUS_BUCKET_LABELS = {
  new: "تحت المراجعة",
  newOrders: "تحت المراجعة",
  canceled: "لاغي",
  cancelled: "لاغي",
  no_replay: "لا يرد",
  follow_up: "متابعة",
  repeater: "مكرر",
  Confirmed: "تم التأكيد",
  Shipped: "تم الشحن",
  confirmedOrders: "تم التأكيد",
  shippedOrders: "تم الشحن",
  canceledOrders: "لاغي",
  noReplyOrders: "لا يرد",
  followUpOrders: "متابعة",
  repeaterOrders: "مكرر",
};

function humanizeBucketKey(key) {
  if (key === "__unset") return "غير محدد (__unset)";
  return (
    ORDER_SOURCE_LABELS[key] ??
    SHIPPING_STATUS_LABELS[key] ??
    ORDER_STATUS_BUCKET_LABELS[key] ??
    ORDER_TYPE_LABELS[key] ??
    key
  );
}

function pickDeltaPct(stats, ...keys) {
  const cmp = stats?.comparison ?? stats?.delta ?? stats?.changes;
  if (!cmp || typeof cmp !== "object") return undefined;
  for (const k of keys) {
    const v = cmp[k];
    if (typeof v === "number" && !Number.isNaN(v)) return Math.round(v * 10) / 10;
    if (v != null && typeof v === "object" && typeof v.pct === "number") return v.pct;
  }
  return undefined;
}

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

function computeDateRangeParams({ dateRange, dateFrom, dateTo }) {
  const params = {};
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

function buildStatsQueryParams({
  dateRange,
  dateFrom,
  dateTo,
  employeeId,
  employees,
  product_id,
}) {
  const params = { ...computeDateRangeParams({ dateRange, dateFrom, dateTo }) };
  Object.assign(params, resolveEmployeeOrderFilterParams(employees, employeeId));
  const pid = typeof product_id === "string" ? product_id.trim() : "";
  if (pid) params.product_id = pid;
  return params;
}

function buildAnalyticsQueryParams({
  dateRange,
  dateFrom,
  dateTo,
  employeeId,
  employees,
  product_id,
}) {
  const params = { ...computeDateRangeParams({ dateRange, dateFrom, dateTo }) };
  Object.assign(params, resolveEmployeeOrderFilterParams(employees, employeeId));
  const pid = typeof product_id === "string" ? product_id.trim() : "";
  if (pid) params.product_id = pid;
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
  return {
    stats: normalizeStatsPayload(response) ?? {},
  };
}

function effectiveEmployeeIdForDashboard(employeeFilter) {
  const trimmed = String(employeeFilter ?? "").trim();
  if (trimmed) return trimmed;
  if (!isStoredUserAdmin()) {
    const self = getSelfEmployeeRowsForFilter()[0];
    return self?.id ? String(self.id).trim() : "";
  }
  return "";
}

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dateRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        if (!isStoredUserAdmin()) {
          if (!cancelled) setEmployees(getSelfEmployeeRowsForFilter());
          return;
        }
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

    async function loadAllProducts() {
      const limit = 100;
      const aggregated = [];
      try {
        setProductsLoading(true);
        let page = 1;
        while (!cancelled) {
          const data = await getProducts({ page, limit });
          const list = normalizeProductList(data);
          aggregated.push(...list);
          const totalPages =
            data?.totalPages ?? data?.pagination?.totalPages ?? null;
          const done =
            list.length === 0 ||
            list.length < limit ||
            (totalPages != null && page >= totalPages);
          if (done) break;
          page += 1;
          if (page > 200) break;
        }
        if (!cancelled) setProducts(aggregated);
      } catch (error) {
        console.log(error);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadAllProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const item of products) {
      const id = getProductFilterId(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const { name, sku } = getProductListLabel(item);
      const label = sku ? `${name} — ${sku}` : name;
      rows.push({ id, label });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return rows;
  }, [products]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingStats(true);
        const payload = await fetchDashboardStats({
          dateRange,
          dateFrom,
          dateTo,
          employeeId: effectiveEmployeeIdForDashboard(employeeFilter),
          employees,
          product_id: productFilter,
        });
        if (!cancelled) {
          setStats(payload.stats);
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange, dateFrom, dateTo, employeeFilter, employees, productFilter]);

  useEffect(() => {
    const pid = String(productFilter ?? "").trim();
    if (!pid) {
      setAnalytics(null);
      setAnalyticsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setAnalyticsLoading(true);
        const query = buildAnalyticsQueryParams({
          dateRange,
          dateFrom,
          dateTo,
          employeeId: effectiveEmployeeIdForDashboard(employeeFilter),
          employees,
          product_id: pid,
        });
        const res = await getOrdersAnalytics(query);
        if (!cancelled) setAnalytics(res);
      } catch (error) {
        console.log(error);
        if (!cancelled) setAnalytics(null);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange, dateFrom, dateTo, employeeFilter, employees, productFilter]);

  async function handleRefreshStats() {
    try {
      setLoadingStats(true);
      const payload = await fetchDashboardStats({
        dateRange,
        dateFrom,
        dateTo,
        employeeId: effectiveEmployeeIdForDashboard(employeeFilter),
        employees,
        product_id: productFilter,
      });
      setStats(payload.stats);

      const pid = String(productFilter ?? "").trim();
      if (pid) {
        setAnalyticsLoading(true);
        try {
          const query = buildAnalyticsQueryParams({
            dateRange,
            dateFrom,
            dateTo,
            employeeId: effectiveEmployeeIdForDashboard(employeeFilter),
            employees,
            product_id: pid,
          });
          const res = await getOrdersAnalytics(query);
          setAnalytics(res);
        } catch (e) {
          console.log(e);
          setAnalytics(null);
        } finally {
          setAnalyticsLoading(false);
        }
      } else {
        setAnalytics(null);
        setAnalyticsLoading(false);
      }
    } catch (error) {
      console.log(error);
      setStats(null);
      setAnalytics(null);
    } finally {
      setLoadingStats(false);
    }
  }

  const totalOrders = pickStat(stats, "totalOrders", "total_orders");
  const shippedCount = pickStat(stats, "Shipped", "shipped", "shippedOrders");
  const canceledCount = pickStat(
    stats,
    "canceled",
    "cancelled",
    "cancelledOrders",
    "canceledOrders",
  );
  const totalSales = pickStat(stats, "totalRevenue", "totalSales", "total_sales");
  const totalPieces = pickStat(
    stats,
    "totalPieces",
    "total_pieces",
    "piecesCount",
    "itemsCount",
    "totalItems",
    "total_units",
  );

  const newOrdersCount = useMemo(
    () => firstBucketValue(stats?.byOrderStatus, ["new", "newOrders"]),
    [stats],
  );

  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const avgPiecesPerOrder =
    totalOrders > 0 && totalPieces > 0
      ? totalPieces / totalOrders
      : pickStat(stats, "avgPiecesPerOrder", "averagePiecesPerOrder");

  const periodHint = "حسب الفترة والفلتر الحالي";
  const productSummaryHint = "ملخص المنتج المختار (تحليلات)";

  const kpiCards = useMemo(() => {
    const productId = String(productFilter ?? "").trim();
    const s = analytics?.summary;
    if (productId && s && typeof s === "object") {
      const totalOrdersSum = Number(s.totalOrders ?? 0);
      const totalCost = Number(s.totalCost ?? 0);
      const totalProductUnits = Number(s.totalProductUnits ?? 0);
      const avgOrder = Number(s.averageOrderValue ?? 0);
      const avgUnits = Number(s.averageUnitsPerOrder ?? 0);
      return [
        {
          key: "sum_totalOrders",
          title: "عدد الطلبات",
          value: totalOrdersSum.toLocaleString("ar-EG"),
          icon: "🛍️",
          changeText: productSummaryHint,
          accent: "#22c55e",
          trendPercent: undefined,
        },
        {
          key: "sum_totalCost",
          title: "إجمالي التكلفة",
          value: `${Math.round(totalCost).toLocaleString("ar-EG")} ج.م`,
          icon: "🪙",
          changeText: productSummaryHint,
          accent: "#eab308",
          trendPercent: undefined,
        },
        {
          key: "sum_totalProductUnits",
          title: "وحدات المنتج",
          value: Math.round(totalProductUnits).toLocaleString("ar-EG"),
          icon: "📦",
          changeText: productSummaryHint,
          accent: "#0ea5e9",
          trendPercent: undefined,
        },
        {
          key: "sum_avgOrder",
          title: "متوسط قيمة الطلب",
          value: `${avgOrder.toLocaleString("ar-EG", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} ج.م`,
          icon: "📄",
          changeText: productSummaryHint,
          accent: "#3b82f6",
          trendPercent: undefined,
        },
        {
          key: "sum_avgUnits",
          title: "متوسط الوحدات / طلب",
          value: avgUnits.toLocaleString("ar-EG", {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
          }),
          icon: "📈",
          changeText: productSummaryHint,
          accent: "#8b5cf6",
          trendPercent: undefined,
        },
      ];
    }

    return [
      {
        key: "total",
        title: "إجمالي الطلبات",
        value: totalOrders.toLocaleString("ar-EG"),
        icon: "🛍️",
        changeText: periodHint,
        accent: "#22c55e",
        trendPercent: pickDeltaPct(stats, "totalOrdersPct", "totalOrders"),
      },
      {
        key: "new",
        title: "طلبات تحت المراجعة",
        value: newOrdersCount.toLocaleString("ar-EG"),
        icon: "🛒",
        changeText: periodHint,
        accent: "#3b82f6",
        trendPercent: pickDeltaPct(stats, "newOrdersPct", "newOrders"),
      },
      {
        key: "shipped",
        title: "تم الشحن",
        value: shippedCount.toLocaleString("ar-EG"),
        icon: "🚚",
        changeText: periodHint,
        accent: "#a855f7",
        trendPercent: pickDeltaPct(stats, "shippedPct", "shipped"),
      },
      {
        key: "canceled",
        title: "طلبات ملغية",
        value: canceledCount.toLocaleString("ar-EG"),
        icon: "❌",
        changeText: periodHint,
        accent: "#ef4444",
        trendPercent: pickDeltaPct(stats, "canceledPct", "canceled"),
      },
      {
        key: "sales",
        title: "إجمالي المبيعات",
        value: `${Math.round(totalSales).toLocaleString("ar-EG")} ج.م`,
        icon: "🪙",
        changeText: periodHint,
        accent: "#eab308",
        trendPercent: pickDeltaPct(stats, "salesPct", "totalSales"),
      },
      {
        key: "pieces",
        title: "عدد القطع",
        value: Math.round(totalPieces).toLocaleString("ar-EG"),
        icon: "📦",
        changeText: periodHint,
        accent: "#0ea5e9",
        trendPercent: pickDeltaPct(stats, "piecesPct", "totalPieces"),
      },
      {
        key: "avg_order",
        title: "متوسط قيمة الطلب",
        value: `${Math.round(avgOrderValue).toLocaleString("ar-EG")} ج.م`,
        icon: "📄",
        changeText: periodHint,
        accent: "#3b82f6",
        trendPercent: pickDeltaPct(stats, "avgOrderValuePct"),
      },
      {
        key: "avg_pieces",
        title: "متوسط القطع / الطلب",
        value: (avgPiecesPerOrder > 0 ? avgPiecesPerOrder : 0).toLocaleString("ar-EG", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        }),
        icon: "📈",
        changeText: periodHint,
        accent: "#8b5cf6",
        trendPercent: pickDeltaPct(stats, "avgPiecesPct"),
      },
    ];
  }, [
    analytics?.summary,
    productFilter,
    avgOrderValue,
    avgPiecesPerOrder,
    canceledCount,
    newOrdersCount,
    shippedCount,
    stats,
    totalOrders,
    totalPieces,
    totalSales,
  ]);

  const labelOrderSource = useCallback(
    (k) => ORDER_SOURCE_LABELS[k] ?? humanizeBucketKey(k),
    [],
  );
  const labelOrderType = useCallback(
    (k) => ORDER_TYPE_LABELS[k] ?? humanizeBucketKey(k),
    [],
  );
  const labelShipping = useCallback(
    (k) => SHIPPING_STATUS_LABELS[k] ?? humanizeBucketKey(k),
    [],
  );

  const latestOrders = useMemo(() => {
    const fromApi = Array.isArray(stats?.latestOrders) ? stats.latestOrders : null;
    if (fromApi && fromApi.length > 0) {
      return fromApi.slice(0, 6).map((order, idx) => ({
        id: order?.id ?? order?.orderId ?? `#${1000 + idx}`,
        status: order?.status ?? "تحت المراجعة",
        amount: `${Number(order?.amount ?? order?.total ?? 0).toLocaleString("ar-EG")} ج`,
        date: order?.date ?? order?.createdAt?.slice(0, 10) ?? "-",
      }));
    }

    return [
      { id: "#4521", status: "مؤكد", amount: "1,250 ج", date: "2026-04-28" },
      { id: "#4518", status: "تحت المراجعة", amount: "980 ج", date: "2026-04-28" },
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
            {employees.map((emp) => {
              const eid = String(emp?.id ?? emp?._id ?? emp?.employeeId ?? "").trim();
              if (!eid) return null;
              return (
                <option key={eid} value={eid}>
                  {emp.name ?? emp.email ?? `موظف #${eid}`}
                </option>
              );
            })}
          </select>
          <select
            className="dashboard-select dashboard-select--product"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            disabled={productsLoading}
            aria-label="تصفية حسب المنتج"
            title="تصفية حسب المنتج"
          >
            <option value="">
              {productsLoading ? "جاري تحميل المنتجات..." : "كل المنتجات"}
            </option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
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
          <section
            className={`dashboard-kpis ${
              String(productFilter ?? "").trim() && analytics?.summary
                ? "dashboard-kpis--summary"
                : "dashboard-kpis--8"
            }`}
          >
            {kpiCards.map((card) => (
              <StatCard
                key={card.key}
                title={card.title}
                value={card.value}
                changeText={card.changeText}
                icon={card.icon}
                accent={card.accent}
                trendPercent={card.trendPercent}
              />
            ))}
          </section>

          <section className="dashboard-charts-row">
            <OrdersStatusBarChart byOrderStatus={stats.byOrderStatus} />
            <OrdersDonutCard
              title="مصادر الطلبات"
              subtitle="توزيع الطلبات حسب المصدر"
              data={stats.byOrderSource}
              labelForKey={labelOrderSource}
            />
          </section>

          <section className="dashboard-charts-row">
            <OrdersDonutCard
              title="نوع الطلب"
              subtitle="أوردر جديد، استبدال، مرتجع"
              data={stats.byOrderType}
              labelForKey={labelOrderType}
            />
            <OrdersDonutCard
              title="حالة الشحن"
              subtitle="حسب حالة التوصيل"
              data={stats.byShippingStatus}
              labelForKey={labelShipping}
            />
          </section>

     

      
        </>
      )}
    </div>
  );
}
