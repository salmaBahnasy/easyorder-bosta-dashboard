import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadOrdersExportFile,
  exportOrdersStatsTrend,
  getEmployees,
  getOrderCostChart,
  saveOrderCostDay,
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
  ProductOrdersDonutCard,
  ProductSalesLineChart,
  SHIPPING_STATUS_DONUT_DEFS,
  TREND_METRIC_DEFS,
} from "../../components/dashboard/DashboardCharts";
import StatCard from "../../components/dashboard/StatCard";
import {
  DonutCardSkeleton,
  KpiCardsSkeleton,
  TrendChartSkeleton,
} from "../../components/dashboard/DashboardStatsSkeleton";
import "./HomePage.css";
import SearchableSelect from "../../components/SearchableSelect";
import {
  getProductFilterId,
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";
import {
  computeEgyptDateRangeParams,
  egyptTodayYmd,
  filterPointsUpToToday,
} from "../../utils/dateRange";

const TREND_PERIOD_OPTIONS = [
  { value: "daily", label: "يومي" },
  { value: "weekly", label: "أسبوعي" },
  { value: "monthly", label: "شهري" },
];

function normalizeProductIds(productIds) {
  const list = Array.isArray(productIds)
    ? productIds
    : String(productIds ?? "").split(",");
  return [
    ...new Set(list.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ];
}

function buildTrendQueryParams({
  dateRange,
  dateFrom,
  dateTo,
  employeeId,
  employees,
  product_ids,
}) {
  const params = {
    ...computeEgyptDateRangeParams({ dateRange, dateFrom, dateTo }),
  };
  Object.assign(
    params,
    resolveEmployeeOrderFilterParams(employees, employeeId),
  );
  const ids = normalizeProductIds(product_ids);
  if (ids.length) params.product_ids = ids.join(",");
  return params;
}

function normalizeTrendChart(response) {
  const chart = response?.chart ?? response?.data?.chart ?? null;
  if (!chart) return null;
  return {
    ...chart,
    points: filterPointsUpToToday(chart.points),
  };
}

function normalizeProductSalesChart(response) {
  const chart = response?.chart ?? response?.data?.chart ?? null;
  if (!chart) return null;
  const products = Array.isArray(chart.products)
    ? chart.products.map((p) => ({
        ...p,
        points: filterPointsUpToToday(p.points),
      }))
    : chart.products;
  return { ...chart, products };
}

function normalizeStatsPayload(response) {
  return response?.stats ?? response?.data?.stats ?? response?.data ?? response;
}

function buildProductSalesQueryParams({
  dateRange,
  dateFrom,
  dateTo,
  granularity,
}) {
  const params = {
    ...computeEgyptDateRangeParams({ dateRange, dateFrom, dateTo }),
  };
  const g = String(granularity ?? "day").trim();
  if (g) params.granularity = g;
  return params;
}

/** GET chart: from/to + date_basis. بدون from/to → الـ API يستخدم آخر 30 يوم. */
function buildOrderCostChartRangeQuery({
  dateFrom,
  dateTo,
  date_basis = "created",
}) {
  const from = String(dateFrom ?? "").trim();
  const to = String(dateTo ?? "").trim();
  const basis = String(date_basis ?? "created").trim() || "created";
  const params = { date_basis: basis };
  if (from && to) {
    Object.assign(
      params,
      computeEgyptDateRangeParams({ dateFrom: from, dateTo: to }),
    );
  }
  return params;
}

function normalizeCostMetricBlock(block) {
  if (!block || typeof block !== "object") return null;
  return {
    labelAr: block.labelAr ?? block.label_ar,
    descriptionAr: block.descriptionAr ?? block.description_ar,
    totalOrders: block.totalOrders ?? block.total_orders ?? 0,
    totalSales: block.totalSales ?? block.total_sales ?? 0,
    salesPerOrder: block.salesPerOrder ?? block.sales_per_order ?? 0,
    costPerOrder: block.costPerOrder ?? block.cost_per_order ?? 0,
    salesPerExpense: block.salesPerExpense ?? block.sales_per_expense ?? 0,
  };
}

function normalizeOrderCostChart(response) {
  const raw = response?.chart ?? response?.data?.chart ?? null;
  if (!raw) return null;

  const points = filterPointsUpToToday(
    Array.isArray(raw.points)
      ? raw.points.map((p) => ({
          date: p.date,
          expense: p.expense,
          expenseEntered: Boolean(p.expenseEntered ?? p.expense_entered),
          orders: normalizeCostMetricBlock(p.orders),
          shipped: normalizeCostMetricBlock(p.shipped),
          delivered: normalizeCostMetricBlock(p.delivered ?? p.successful),
        }))
      : [],
  );

  return {
    source: raw.source,
    dateBasis: raw.dateBasis ?? raw.date_basis,
    liveFilledDaysCount:
      raw.liveFilledDaysCount ?? raw.live_filled_days_count ?? 0,
    expense: raw.expense,
    expenseEntered: raw.expenseEntered ?? raw.expense_entered,
    formulaAr: raw.formulaAr ?? raw.formula_ar,
    points,
    summary: raw.summary
      ? {
          orders: normalizeCostMetricBlock(raw.summary?.orders),
          shipped: normalizeCostMetricBlock(raw.summary?.shipped),
          delivered: normalizeCostMetricBlock(
            raw.summary?.delivered ?? raw.summary?.successful,
          ),
        }
      : null,
  };
}

export default function HomePage() {
  const [trendChart, setTrendChart] = useState(null);
  const [productSalesChart, setProductSalesChart] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProductSales, setLoadingProductSales] = useState(true);
  const [chartMetric, setChartMetric] = useState("totalOrders");
  const [trendPeriod, setTrendPeriod] = useState("daily");
  const [exportingTrend, setExportingTrend] = useState(false);
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
  const [productFilter, setProductFilter] = useState([]);
  const [orderCostsExpense, setOrderCostsExpense] = useState("");
  const [orderCostsSaveDate, setOrderCostsSaveDate] = useState(() =>
    egyptTodayYmd(),
  );
  const [orderCostsError, setOrderCostsError] = useState("");
  const [orderCostsSuccess, setOrderCostsSuccess] = useState("");
  const [orderCostsSaving, setOrderCostsSaving] = useState(false);
  const [orderCostChart, setOrderCostChart] = useState(null);
  const [orderCostChartLoading, setOrderCostChartLoading] = useState(false);
  const [orderCostSeries, setOrderCostSeries] = useState("orders");
  const [orderCostDateBasis, setOrderCostDateBasis] = useState("created");

  const buildDashboardQuery = useCallback(
    () =>
      buildTrendQueryParams({
        dateRange,
        dateFrom,
        dateTo,
        employeeId: String(employeeFilter ?? "").trim(),
        employees,
        product_ids: productFilter,
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

  const applyProductSalesSelection = useCallback((productSales) => {
    const productsList = Array.isArray(productSales?.products)
      ? productSales.products
      : [];
    setProductSalesProductId((current) => {
      if (productsList.length === 0) return "";
      if (productsList.some((p) => p.product_id === current)) return current;
      return productsList[0].product_id;
    });
  }, []);

  const dashboardLoadGenRef = useRef(0);
  const trendLoadGenRef = useRef(0);

  const loadTrendChart = useCallback(() => {
    const query = { ...buildDashboardQuery(), period: trendPeriod };
    const gen = trendLoadGenRef.current + 1;
    trendLoadGenRef.current = gen;
    setLoadingTrend(true);

    getOrdersStatsTrend(query)
      .then((trendRes) => {
        if (trendLoadGenRef.current !== gen) return;
        setTrendChart(normalizeTrendChart(trendRes));
      })
      .catch((error) => {
        console.log(error);
        if (trendLoadGenRef.current !== gen) return;
        setTrendChart(null);
      })
      .finally(() => {
        if (trendLoadGenRef.current === gen) setLoadingTrend(false);
      });
  }, [buildDashboardQuery, trendPeriod]);

  const loadDashboardSections = useCallback(() => {
    const query = buildDashboardQuery();
    const productSalesQuery = buildProductSalesQuery();
    const gen = dashboardLoadGenRef.current + 1;
    dashboardLoadGenRef.current = gen;

    setLoadingStats(true);
    setLoadingProductSales(true);

    getOrdersStats(query)
      .then((statsRes) => {
        if (dashboardLoadGenRef.current !== gen) return;
        setStats(normalizeStatsPayload(statsRes) ?? {});
      })
      .catch((error) => {
        console.log(error);
        if (dashboardLoadGenRef.current !== gen) return;
        setStats(null);
      })
      .finally(() => {
        if (dashboardLoadGenRef.current === gen) setLoadingStats(false);
      });

    getProductSalesChart(productSalesQuery)
      .then((productSalesRes) => {
        if (dashboardLoadGenRef.current !== gen) return;
        const productSales = normalizeProductSalesChart(productSalesRes);
        setProductSalesChart(productSales);
        applyProductSalesSelection(productSales);
      })
      .catch((error) => {
        console.log(error);
        if (dashboardLoadGenRef.current !== gen) return;
        setProductSalesChart(null);
        setProductSalesProductId("");
      })
      .finally(() => {
        if (dashboardLoadGenRef.current === gen) setLoadingProductSales(false);
      });
  }, [applyProductSalesSelection, buildDashboardQuery, buildProductSalesQuery]);

  const fetchOrderCostChart = useCallback(async () => {
    const query = buildOrderCostChartRangeQuery({
      dateFrom,
      dateTo,
      date_basis: orderCostDateBasis,
    });

    setOrderCostChartLoading(true);
    setOrderCostsError("");
    try {
      const response = await getOrderCostChart(query);
      setOrderCostChart(normalizeOrderCostChart(response));
    } catch (error) {
      console.log(error);
      setOrderCostChart(null);
      const message =
        error?.response?.data?.message ?? "تعذر تحميل جراف تكلفة الطلبات";
      setOrderCostsError(message);
    } finally {
      setOrderCostChartLoading(false);
    }
  }, [dateFrom, dateTo, orderCostDateBasis]);

  const saveOrderCostDayEntry = useCallback(async () => {
    const day = String(orderCostsSaveDate ?? "").trim();
    const expenseNum = Number(orderCostsExpense);
    if (!day) {
      setOrderCostsError("اختاري تاريخ اليوم");
      setOrderCostsSuccess("");
      return;
    }
    if (
      !Number.isFinite(expenseNum) ||
      expenseNum < 0 ||
      String(orderCostsExpense ?? "").trim() === ""
    ) {
      setOrderCostsError("أدخلي المصروفات (رقم ≥ 0)");
      setOrderCostsSuccess("");
      return;
    }

    setOrderCostsSaving(true);
    setOrderCostsError("");
    setOrderCostsSuccess("");
    try {
      await saveOrderCostDay({
        date: day,
        expense: expenseNum,
        date_basis: orderCostDateBasis,
      });
      setOrderCostsSuccess(`تم حفظ مصروفات يوم ${day} بنجاح`);
      await fetchOrderCostChart();
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ?? "تعذر حفظ مصروفات اليوم";
      setOrderCostsError(message);
    } finally {
      setOrderCostsSaving(false);
    }
  }, [
    orderCostsSaveDate,
    orderCostsExpense,
    orderCostDateBasis,
    fetchOrderCostChart,
  ]);

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
    loadDashboardSections();
    return () => {
      dashboardLoadGenRef.current += 1;
    };
  }, [loadDashboardSections]);

  useEffect(() => {
    loadTrendChart();
    return () => {
      trendLoadGenRef.current += 1;
    };
  }, [loadTrendChart]);

  useEffect(() => {
    fetchOrderCostChart();
  }, [fetchOrderCostChart]);

  function handleRefreshStats() {
    loadDashboardSections();
    loadTrendChart();
    fetchOrderCostChart();
  }

  async function handleExportTrend() {
    try {
      setExportingTrend(true);
      const result = await exportOrdersStatsTrend({
        ...buildDashboardQuery(),
        period: trendPeriod,
      });
      downloadOrdersExportFile(result);
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ??
        error?.message ??
        "تعذر تصدير اتجاه الأداء";
      alert(message);
    } finally {
      setExportingTrend(false);
    }
  }

  const summary = trendChart?.summary ?? {};
  const trendPoints = trendChart?.points ?? [];
  const productSalesProducts = productSalesChart?.products ?? [];
  const periodHint = "ملخص الفترة المحددة";
  const allSectionsFailed =
    !loadingTrend &&
    !loadingStats &&
    !loadingProductSales &&
    !trendChart &&
    !stats &&
    !productSalesChart;

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
    () =>
      buildDonutSegments(SHIPPING_STATUS_DONUT_DEFS, stats?.byShippingStatus),
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
              const eid = String(
                emp?.id ?? emp?._id ?? emp?.employeeId ?? "",
              ).trim();
              if (!eid) return null;
              return (
                <option key={eid} value={eid}>
                  {emp.name ?? emp.email ?? `موظف #${eid}`}
                </option>
              );
            })}
          </select>
          <SearchableSelect
            className="dashboard-select--product dashboard-product-multiselect"
            multiple
            value={productFilter}
            onChange={(next) => setProductFilter(normalizeProductIds(next))}
            options={productOptions}
            getOptionValue={(option) => option.id}
            getOptionLabel={(option) => option.label}
            placeholder={
              productsLoading ? "جاري تحميل المنتجات..." : "كل المنتجات"
            }
            searchPlaceholder="ابحث عن منتج..."
            disabled={productsLoading}
            loading={productsLoading}
            emptyText="لا توجد منتجات"
            panelFixed
          />

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
          <button
            type="button"
            className="dashboard-refresh-btn"
            onClick={handleRefreshStats}
          >
            تحديث الداتا
          </button>
        </div>
      </section>

      {allSectionsFailed ? (
        <p className="dashboard-load-error">تعذر تحميل الإحصائيات حاليًا.</p>
      ) : (
        <>
          {loadingTrend ? (
            <>
              <KpiCardsSkeleton />
              <section className="dashboard-charts-row dashboard-charts-row--trend-pair">
                <TrendChartSkeleton />
              </section>
            </>
          ) : trendChart ? (
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
                <OrdersTrendLineChart
                  points={trendPoints}
                  metricKey={chartMetric}
                  onMetricChange={setChartMetric}
                  period={trendPeriod}
                  onPeriodChange={setTrendPeriod}
                  periodOptions={TREND_PERIOD_OPTIONS}
                  onExport={handleExportTrend}
                  exporting={exportingTrend}
                />
              </section>
            </>
          ) : null}

          {loadingProductSales ? (
            <section className="dashboard-charts-row dashboard-charts-row--product-analytics">
              <TrendChartSkeleton />
              <DonutCardSkeleton />
            </section>
          ) : productSalesChart ? (
            <section className="dashboard-charts-row dashboard-charts-row--product-analytics">
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
              <ProductOrdersDonutCard
                products={productSalesProducts}
                truncated={Boolean(productSalesChart?.truncated)}
              />
            </section>
          ) : null}

          {loadingStats ? (
            <section className="dashboard-charts-row dashboard-charts-row--donuts">
              {Array.from({ length: 4 }).map((_, index) => (
                <DonutCardSkeleton key={`donut-skel-${index}`} />
              ))}
            </section>
          ) : stats ? (
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
        saveDate={orderCostsSaveDate}
        onExpenseChange={(value) => {
          setOrderCostsExpense(value);
          if (orderCostsError) setOrderCostsError("");
          if (orderCostsSuccess) setOrderCostsSuccess("");
        }}
        onSaveDateChange={(value) => {
          setOrderCostsSaveDate(value);
          if (orderCostsError) setOrderCostsError("");
          if (orderCostsSuccess) setOrderCostsSuccess("");
        }}
        onSave={saveOrderCostDayEntry}
        saving={orderCostsSaving}
        successMessage={orderCostsSuccess}
        chartPeriodHint={
          dateFrom && dateTo
            ? `الجراف: من ${dateFrom} إلى ${dateTo}`
            : "الجراف: آخر 30 يوم (افتراضي)"
        }
        error={orderCostsError}
        orderCostChart={orderCostChart}
        orderCostChartLoading={orderCostChartLoading}
        orderCostSeries={orderCostSeries}
        onOrderCostSeriesChange={setOrderCostSeries}
        orderCostDateBasis={orderCostDateBasis}
        onOrderCostDateBasisChange={setOrderCostDateBasis}
      />
    </div>
  );
}
