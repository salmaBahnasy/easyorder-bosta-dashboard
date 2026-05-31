import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployees,
  getOrderCosts,
  getOrdersStats,
  getOrdersStatsTrend,
  getProductSalesChart,
  getProducts,
  resolveEmployeeOrderFilterParams,
} from "../../api/ordersApi";
import OrderCostsSection from "../../components/dashboard/OrderCostsSection";
import {
  buildDonutSegments,
  ORDER_SOURCE_DONUT_DEFS,
  ORDER_STATUS_DONUT_DEFS,
  ORDER_TYPE_DONUT_DEFS,
  OrdersDonutCard,
  OrdersTrendLineChart,
  ProductSalesLineChart,
  SHIPPING_STATUS_DONUT_DEFS,
  TREND_METRIC_DEFS,
} from "../../components/dashboard/DashboardCharts";
import StatCard from "../../components/dashboard/StatCard";
import DashboardStatsSkeleton from "../../components/dashboard/DashboardStatsSkeleton";
import "./HomePage.css";
import {
  getProductFilterId,
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";
import { computeEgyptDateRangeParams } from "../../utils/dateRange";

function buildTrendQueryParams({
  dateRange,
  dateFrom,
  dateTo,
  employeeId,
  employees,
  product_id,
}) {
  const params = { ...computeEgyptDateRangeParams({ dateRange, dateFrom, dateTo }) };
  Object.assign(params, resolveEmployeeOrderFilterParams(employees, employeeId));
  const pid = typeof product_id === "string" ? product_id.trim() : "";
  if (pid) params.product_id = pid;
  return params;
}

function normalizeTrendChart(response) {
  return response?.chart ?? response?.data?.chart ?? null;
}

function normalizeProductSalesChart(response) {
  return response?.chart ?? response?.data?.chart ?? null;
}

function normalizeStatsPayload(response) {
  return response?.stats ?? response?.data?.stats ?? response?.data ?? response;
}

function buildProductSalesQueryParams({ dateRange, dateFrom, dateTo, granularity }) {
  const params = { ...computeEgyptDateRangeParams({ dateRange, dateFrom, dateTo }) };
  const g = String(granularity ?? "day").trim();
  if (g) params.granularity = g;
  return params;
}

function buildOrderCostsQueryParams({ expense, dateFrom, dateTo }) {
  const expenseNum = Number(expense);
  const params = { expense: expenseNum };
  const from = String(dateFrom ?? "").trim();
  const to = String(dateTo ?? "").trim();

  if (from && to && from === to) {
    params.date = from;
  } else if (from && to) {
    Object.assign(params, computeEgyptDateRangeParams({ dateFrom: from, dateTo: to }));
  } else if (from) {
    params.date = from;
  } else if (to) {
    params.date = to;
  }

  return params;
}

function normalizeOrderCostsMetrics(response) {
  return response?.metrics ?? response?.data?.metrics ?? null;
}

function formatCostsPeriodHint(dateFrom, dateTo) {
  const from = String(dateFrom ?? "").trim();
  const to = String(dateTo ?? "").trim();
  if (from && to && from === to) return `يوم ${from}`;
  if (from && to) return `من ${from} إلى ${to}`;
  if (from) return `من ${from}`;
  if (to) return `حتى ${to}`;
  return "الشهر الحالي (افتراضي)";
}

export default function HomePage() {
  const [trendChart, setTrendChart] = useState(null);
  const [productSalesChart, setProductSalesChart] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [chartMetric, setChartMetric] = useState("totalOrders");
  const [productSalesProductId, setProductSalesProductId] = useState("");
  const [productSalesMetric, setProductSalesMetric] = useState("totalUnits");
  const [productSalesGranularity, setProductSalesGranularity] = useState("day");
  const [dateRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [orderCostsExpense, setOrderCostsExpense] = useState("");
  const [orderCostsMetrics, setOrderCostsMetrics] = useState(null);
  const [orderCostsLoading, setOrderCostsLoading] = useState(false);
  const [orderCostsError, setOrderCostsError] = useState("");

  const buildDashboardQuery = useCallback(
    () =>
      buildTrendQueryParams({
        dateRange,
        dateFrom,
        dateTo,
        employeeId: String(employeeFilter ?? "").trim(),
        employees,
        product_id: productFilter,
      }),
    [dateRange, dateFrom, dateTo, employeeFilter, employees, productFilter],
  );

  const buildProductSalesQuery = useCallback(
    () =>
      buildProductSalesQueryParams({
        dateRange,
        dateFrom,
        dateTo,
        granularity: productSalesGranularity,
      }),
    [dateRange, dateFrom, dateTo, productSalesGranularity],
  );

  const fetchDashboardData = useCallback(async () => {
    const query = buildDashboardQuery();
    const productSalesQuery = buildProductSalesQuery();
    const [trendRes, statsRes, productSalesRes] = await Promise.all([
      getOrdersStatsTrend(query),
      getOrdersStats(query),
      getProductSalesChart(productSalesQuery),
    ]);
    return {
      chart: normalizeTrendChart(trendRes),
      stats: normalizeStatsPayload(statsRes) ?? {},
      productSales: normalizeProductSalesChart(productSalesRes),
    };
  }, [buildDashboardQuery, buildProductSalesQuery]);

  const fetchOrderCostsData = useCallback(async (expenseValue = orderCostsExpense) => {
    const expenseNum = Number(expenseValue);
    if (!Number.isFinite(expenseNum) || expenseNum < 0 || String(expenseValue ?? "").trim() === "") {
      setOrderCostsError("أدخلي المصروفات (رقم ≥ 0)");
      setOrderCostsMetrics(null);
      return null;
    }

    const query = buildOrderCostsQueryParams({
      expense: expenseNum,
      dateFrom,
      dateTo,
    });

    setOrderCostsLoading(true);
    setOrderCostsError("");
    try {
      const response = await getOrderCosts(query);
      const metrics = normalizeOrderCostsMetrics(response);
      setOrderCostsMetrics(metrics);
      return metrics;
    } catch (error) {
      console.log(error);
      setOrderCostsMetrics(null);
      const message = error?.response?.data?.message ?? "تعذر حساب تكلفة الطلبات";
      setOrderCostsError(message);
      return null;
    } finally {
      setOrderCostsLoading(false);
    }
  }, [orderCostsExpense, dateFrom, dateTo]);

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
        const { chart, stats: statsPayload, productSales } = await fetchDashboardData();
        if (!cancelled) {
          setTrendChart(chart);
          setStats(statsPayload);
          setProductSalesChart(productSales);
          const products = Array.isArray(productSales?.products) ? productSales.products : [];
          setProductSalesProductId((current) => {
            if (products.length === 0) return "";
            if (products.some((p) => p.product_id === current)) return current;
            return products[0].product_id;
          });
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setTrendChart(null);
          setStats(null);
          setProductSalesChart(null);
          setProductSalesProductId("");
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
      const { chart, stats: statsPayload, productSales } = await fetchDashboardData();
      setTrendChart(chart);
      setStats(statsPayload);
      setProductSalesChart(productSales);
      const products = Array.isArray(productSales?.products) ? productSales.products : [];
      setProductSalesProductId((current) => {
        if (products.length === 0) return "";
        if (products.some((p) => p.product_id === current)) return current;
        return products[0].product_id;
      });
      if (String(orderCostsExpense ?? "").trim() !== "") {
        await fetchOrderCostsData(orderCostsExpense);
      }
    } catch (error) {
      console.log(error);
      setTrendChart(null);
      setStats(null);
      setProductSalesChart(null);
      setProductSalesProductId("");
    } finally {
      setLoadingTrend(false);
    }
  }

  const summary = trendChart?.summary ?? {};
  const trendPoints = trendChart?.points ?? [];
  const productSalesProducts = productSalesChart?.products ?? [];
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

  const orderCostsPeriodHint = useMemo(
    () => formatCostsPeriodHint(dateFrom, dateTo),
    [dateFrom, dateTo],
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
        <DashboardStatsSkeleton />
      ) : !trendChart && !stats && !productSalesChart ? (
        <p className="dashboard-load-error">تعذر تحميل الإحصائيات حاليًا.</p>
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

              <section className="dashboard-charts-row dashboard-charts-row--trend-pair">
                {trendChart ? (
                  <OrdersTrendLineChart
                    points={trendPoints}
                    metricKey={chartMetric}
                    onMetricChange={setChartMetric}
                  />
                ) : null}
                {productSalesChart ? (
                  <ProductSalesLineChart
                    products={productSalesProducts}
                    selectedProductId={productSalesProductId}
                    onProductChange={setProductSalesProductId}
                    metricKey={productSalesMetric}
                    onMetricChange={setProductSalesMetric}
                    granularity={productSalesGranularity}
                    onGranularityChange={setProductSalesGranularity}
                    truncated={Boolean(productSalesChart?.truncated)}
                  />
                ) : null}
              </section>
            </>
          ) : productSalesChart ? (
            <section className="dashboard-charts-row dashboard-charts-row--trend-pair">
              <ProductSalesLineChart
                products={productSalesProducts}
                selectedProductId={productSalesProductId}
                onProductChange={setProductSalesProductId}
                metricKey={productSalesMetric}
                onMetricChange={setProductSalesMetric}
                granularity={productSalesGranularity}
                onGranularityChange={setProductSalesGranularity}
                truncated={Boolean(productSalesChart?.truncated)}
              />
            </section>
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

      <OrderCostsSection
        expense={orderCostsExpense}
        onExpenseChange={(value) => {
          setOrderCostsExpense(value);
          if (orderCostsError) setOrderCostsError("");
        }}
        onCalculate={() => fetchOrderCostsData()}
        loading={orderCostsLoading}
        error={orderCostsError}
        metrics={orderCostsMetrics}
        successfulShippingStatus={orderCostsMetrics?.successfulShippingStatus}
        periodHint={orderCostsPeriodHint}
      />
    </div>
  );
}
