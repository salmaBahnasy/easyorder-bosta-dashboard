import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployees,
  getOrdersStats,
  getOrdersStatsTrend,
  getProducts,
  resolveEmployeeOrderFilterParams,
} from "../../api/ordersApi";
import {
  buildDonutSegments,
  ORDER_SOURCE_DONUT_DEFS,
  ORDER_STATUS_DONUT_DEFS,
  ORDER_TYPE_DONUT_DEFS,
  OrdersDonutCard,
  OrdersTrendLineChart,
  SHIPPING_STATUS_DONUT_DEFS,
  TREND_METRIC_DEFS,
} from "../../components/dashboard/DashboardCharts";
import StatCard from "../../components/dashboard/StatCard";
import "./HomePage.css";
import { getSelfEmployeeRowsForFilter, isStoredUserAdmin } from "../../utils/auth";
import {
  getProductFilterId,
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";

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

function buildTrendQueryParams({
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

function normalizeTrendChart(response) {
  return response?.chart ?? response?.data?.chart ?? null;
}

function normalizeStatsPayload(response) {
  return response?.stats ?? response?.data?.stats ?? response?.data ?? response;
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
  const [trendChart, setTrendChart] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [chartMetric, setChartMetric] = useState("totalOrders");
  const [dateRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productFilter, setProductFilter] = useState("");

  const buildDashboardQuery = useCallback(
    () =>
      buildTrendQueryParams({
        dateRange,
        dateFrom,
        dateTo,
        employeeId: effectiveEmployeeIdForDashboard(employeeFilter),
        employees,
        product_id: productFilter,
      }),
    [dateRange, dateFrom, dateTo, employeeFilter, employees, productFilter],
  );

  const fetchDashboardData = useCallback(async () => {
    const query = buildDashboardQuery();
    const [trendRes, statsRes] = await Promise.all([
      getOrdersStatsTrend(query),
      getOrdersStats(query),
    ]);
    return {
      chart: normalizeTrendChart(trendRes),
      stats: normalizeStatsPayload(statsRes) ?? {},
    };
  }, [buildDashboardQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        const data = await getEmployees();
        const list = Array.isArray(data?.employees)
          ? data.employees
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
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
      try {
        setProductsLoading(true);
        const data = await getProducts({ page: 1, limit: 200 });
        const list = normalizeProductList(data);
        if (!cancelled) setProducts(list);
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
        setLoadingTrend(true);
        const { chart, stats: statsPayload } = await fetchDashboardData();
        if (!cancelled) {
          setTrendChart(chart);
          setStats(statsPayload);
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setTrendChart(null);
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData]);

  async function handleRefreshStats() {
    try {
      setLoadingTrend(true);
      const { chart, stats: statsPayload } = await fetchDashboardData();
      setTrendChart(chart);
      setStats(statsPayload);
    } catch (error) {
      console.log(error);
      setTrendChart(null);
      setStats(null);
    } finally {
      setLoadingTrend(false);
    }
  }

  const summary = trendChart?.summary ?? {};
  const trendPoints = trendChart?.points ?? [];
  const periodHint = "ملخص الفترة المحددة";

  const kpiCards = useMemo(
    () =>
      TREND_METRIC_DEFS.map((def) => ({
        key: def.key,
        title: def.title,
        value: def.formatSummary(summary[def.key]),
        icon: def.icon,
        changeText: periodHint,
        accent: def.accent,
      })),
    [summary, periodHint],
  );

  const orderStatusSegments = useMemo(
    () => buildDonutSegments(ORDER_STATUS_DONUT_DEFS, stats?.byOrderStatus),
    [stats?.byOrderStatus],
  );
  const shippingSegments = useMemo(
    () => buildDonutSegments(SHIPPING_STATUS_DONUT_DEFS, stats?.byShippingStatus),
    [stats?.byShippingStatus],
  );
  const orderSourceSegments = useMemo(
    () => buildDonutSegments(ORDER_SOURCE_DONUT_DEFS, stats?.byOrderSource),
    [stats?.byOrderSource],
  );
  const orderTypeSegments = useMemo(
    () => buildDonutSegments(ORDER_TYPE_DONUT_DEFS, stats?.byOrderType),
    [stats?.byOrderType],
  );

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

      {loadingTrend ? (
        <p>جاري تحميل الإحصائيات...</p>
      ) : !trendChart && !stats ? (
        <p>تعذر تحميل الإحصائيات حاليًا.</p>
      ) : (
        <>
          {trendChart ? (
            <>
              <section className="dashboard-kpis dashboard-kpis--5">
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

              <section className="dashboard-charts-row dashboard-charts-row--trend">
                <OrdersTrendLineChart
                  points={trendPoints}
                  metricKey={chartMetric}
                  onMetricChange={setChartMetric}
                />
              </section>
            </>
          ) : null}

          {stats ? (
            <section className="dashboard-charts-row dashboard-charts-row--donuts">
              <OrdersDonutCard
                title="حالات الطلب"
                subtitle="توزيع الطلبات حسب الحالة"
                segments={orderStatusSegments}
              />
              <OrdersDonutCard
                title="حالات التوصيل"
                subtitle="حسب حالة الشحن"
                segments={shippingSegments}
              />
              <OrdersDonutCard
                title="مصادر الطلب"
                subtitle="متجر، واتساب، وغيرها"
                segments={orderSourceSegments}
              />
              <OrdersDonutCard
                title="نوع الطلب"
                subtitle="جديد، استبدال، مرتجع"
                segments={orderTypeSegments}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
