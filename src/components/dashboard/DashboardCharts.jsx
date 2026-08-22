import { useMemo, useState } from "react";
import { filterPointsUpToToday } from "../../utils/dateRange";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ORDER_BREAKDOWN_SERIES = [
  { key: "value", name: "عدد الطلبات", color: "#22c55e" },
  { key: "shippedOrders", name: "تم الشحن", color: "#3b82f6" },
  { key: "successfulOrders", name: "تم التسليم", color: "#8b5cf6" },
];

export const TREND_METRIC_DEFS = [
  {
    key: "totalOrders",
    title: "عدد الطلبات",
    icon: "🛍️",
    accent: "#22c55e",
    formatSummary: (v) => Number(v ?? 0).toLocaleString("ar-EG"),
    formatTooltip: (v) => [
      Number(v ?? 0).toLocaleString("ar-EG"),
      "عدد الطلبات",
    ],
  },
  {
    key: "total",
    title: "إجمالي المبيعات",
    icon: "🪙",
    accent: "#eab308",
    formatSummary: (v) =>
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "إجمالي المبيعات",
    ],
  },
  {
    key: "totalProductUnits",
    title: "عدد القطع",
    icon: "📦",
    accent: "#0ea5e9",
    formatSummary: (v) => Math.round(Number(v ?? 0)).toLocaleString("ar-EG"),
    formatTooltip: (v) => [
      Math.round(Number(v ?? 0)).toLocaleString("ar-EG"),
      "عدد القطع",
    ],
  },
  {
    key: "averageUnitsPerOrder",
    title: "متوسط القطع للطلب",
    icon: "📈",
    accent: "#8b5cf6",
    formatSummary: (v) =>
      Number(v ?? 0).toLocaleString("ar-EG", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }),
    formatTooltip: (v) => [
      Number(v ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 }),
      "متوسط القطع للطلب",
    ],
  },
  {
    key: "averageOrderValue",
    title: "متوسط سعر الطلب",
    icon: "📄",
    accent: "#3b82f6",
    formatSummary: (v) =>
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "متوسط سعر الطلب",
    ],
  },
];

function formatTrendAxisDate(dateStr, period = "daily") {
  if (!dateStr) return "";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  if (period === "monthly") {
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  }
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${day}/${month}`;
}

function formatTrendTooltipDate(dateStr, period = "daily") {
  if (!dateStr) return "";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  if (period === "monthly") {
    return new Intl.DateTimeFormat("ar-EG", {
      month: "long",
      year: "numeric",
    }).format(d);
  }
  if (period === "weekly") {
    return `أسبوع ${new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "short",
    }).format(d)}`;
  }
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function toChartNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCountWithShare(count, total) {
  const num = Number(count);
  if (!Number.isFinite(num)) return "—";
  const shown = num.toLocaleString("ar-EG");
  const base = Number(total);
  if (!Number.isFinite(base) || base <= 0) return shown;
  const pct = Math.round((num / base) * 100);
  return `${shown} (${pct.toLocaleString("ar-EG")}٪)`;
}

function sharePercent(count, total) {
  const num = Number(count);
  const base = Number(total);
  if (!Number.isFinite(num) || !Number.isFinite(base) || base <= 0) return null;
  return Math.round((num / base) * 100);
}

function formatTrendYAxisTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}ك`;
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

function TrendShareLabel({ x, y, value, fill, position = "top" }) {
  if (x == null || y == null) return null;
  const text = String(value ?? "").trim();
  if (!text || text === "—") return null;
  const w = 78;
  const h = 18;
  const top = position === "bottom" ? y + 8 : y - h - 2;
  return (
    <foreignObject
      x={x - w / 2}
      y={top}
      width={w}
      height={h}
      style={{ overflow: "visible" }}
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        dir="rtl"
        lang="ar"
        style={{
          textAlign: "center",
          fontSize: 11,
          fontWeight: 700,
          color: fill,
          lineHeight: "18px",
          fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </foreignObject>
  );
}

/** محور سفلي بعناوين عربية واضحة دون تداخل (foreignObject + RTL). */
function TrendXAxisTick({ x, y, payload }) {
  const label = String(payload?.value ?? "");
  const w = 52;
  const h = 36;
  return (
    <foreignObject
      x={x - w / 2}
      y={y + 4}
      width={w}
      height={h}
      style={{ overflow: "visible" }}
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        dir="rtl"
        lang="ar"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#475569",
          lineHeight: 1.3,
          fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </foreignObject>
  );
}

export function OrdersTrendLineChart({
  points,
  metricKey,
  onMetricChange,
  period = "daily",
  onPeriodChange,
  periodOptions = [],
  onExport,
  exporting = false,
}) {
  const metric =
    TREND_METRIC_DEFS.find((m) => m.key === metricKey) ?? TREND_METRIC_DEFS[0];
  const showOrderBreakdown = metric.key === "totalOrders";

  const [visibleSeries, setVisibleSeries] = useState({
    value: true,
    shippedOrders: true,
    successfulOrders: true,
  });

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => {
      const nextVisible = !prev[key];
      const next = { ...prev, [key]: nextVisible };
      // Keep at least one series visible
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const chartData = useMemo(() => {
    const list = filterPointsUpToToday(points);
    return list.map((p) => {
      const raw = p?.[metric.key];
      const totalOrders = toChartNumber(p?.totalOrders ?? p?.[metric.key]);
      const shippedOrders = toChartNumber(p?.shippedOrders);
      const successfulOrders = toChartNumber(p?.successfulOrders);
      return {
        date: p?.date,
        dateLabel: formatTrendAxisDate(p?.date, period),
        value: raw == null || raw === "" ? null : Number(raw),
        totalOrders,
        shippedOrders,
        successfulOrders,
        shippedLabel: formatCountWithShare(shippedOrders, totalOrders),
        successfulLabel: formatCountWithShare(successfulOrders, totalOrders),
      };
    });
  }, [points, metric.key, period]);

  const breakdownShares = useMemo(() => {
    const totals = chartData.reduce(
      (acc, row) => {
        acc.orders += Number(row.totalOrders ?? row.value) || 0;
        acc.shipped += Number(row.shippedOrders) || 0;
        acc.successful += Number(row.successfulOrders) || 0;
        return acc;
      },
      { orders: 0, shipped: 0, successful: 0 },
    );
    return {
      shipped: sharePercent(totals.shipped, totals.orders),
      successful: sharePercent(totals.successful, totals.orders),
    };
  }, [chartData]);

  const showPointLabels = showOrderBreakdown && chartData.length <= 16;

  const xTickInterval = useMemo(() => {
    const n = chartData.length;
    const maxTicks = 8;
    if (n <= maxTicks) return 0;
    return Math.max(0, Math.ceil(n / maxTicks) - 1);
  }, [chartData.length]);

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-trend-chart">
      <header className="dashboard-chart-card__header dashboard-trend-chart__header">
        <div className="dashboard-trend-chart__heading">
          <h3>اتجاه الأداء</h3>
          <p>تطور المؤشر خلال الفترة المحددة</p>
        </div>
        <div className="dashboard-trend-chart__toolbar">
          <label className="dashboard-trend-chart__metric-select">
            <span>الفترة</span>
            <select
              value={period}
              onChange={(e) => onPeriodChange?.(e.target.value)}
              aria-label="تصفية اتجاه الأداء يومي أو أسبوعي أو شهري"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="dashboard-trend-chart__metric-select">
            <span>المؤشر</span>
            <select
              value={metric.key}
              onChange={(e) => onMetricChange(e.target.value)}
              aria-label="اختيار مؤشر الرسم البياني"
            >
              {TREND_METRIC_DEFS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          {onExport ? (
            <button
              type="button"
              className="dashboard-trend-chart__export-btn"
              onClick={onExport}
              disabled={exporting}
            >
              {exporting ? "جاري التصدير..." : "تصدير Excel"}
            </button>
          ) : null}
        </div>
      </header>
      {showOrderBreakdown ? (
        <div
          className="dashboard-trend-chart__series-toggles"
          role="group"
          aria-label="إظهار أو إخفاء خطوط الرسم البياني"
        >
          {ORDER_BREAKDOWN_SERIES.map((series) => {
            const isVisible = visibleSeries[series.key];
            const share =
              series.key === "shippedOrders"
                ? breakdownShares.shipped
                : series.key === "successfulOrders"
                  ? breakdownShares.successful
                  : null;
            return (
              <button
                key={series.key}
                type="button"
                className={`dashboard-trend-chart__series-toggle${
                  isVisible ? " is-active" : ""
                }`}
                aria-pressed={isVisible}
                onClick={() => toggleSeries(series.key)}
              >
                <span
                  className="dashboard-trend-chart__series-swatch"
                  style={{ background: series.color }}
                  aria-hidden="true"
                />
                <span>{series.name}</span>
                {share != null ? (
                  <span className="dashboard-trend-chart__series-pct">
                    {share.toLocaleString("ar-EG")}٪
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="dashboard-recharts-wrap dashboard-trend-chart__wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: showPointLabels ? 28 : 16,
              right: 20,
              left: 4,
              bottom: showPointLabels ? 64 : 52,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e8edf5"
            />
            <XAxis
              dataKey="dateLabel"
              tick={TrendXAxisTick}
              interval={xTickInterval}
              minTickGap={28}
              height={52}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
              tickFormatter={formatTrendYAxisTick}
              width={52}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v, _name, item) => {
                const key = item?.dataKey;
                const row = item?.payload;
                const total = row?.totalOrders ?? row?.value;
                if (showOrderBreakdown && key === "shippedOrders") {
                  return [formatCountWithShare(v, total), "تم الشحن"];
                }
                if (showOrderBreakdown && key === "successfulOrders") {
                  return [formatCountWithShare(v, total), "تم التسليم"];
                }
                return metric.formatTooltip(v);
              }}
              labelFormatter={(_l, payload) => {
                const row = payload?.[0]?.payload;
                return row?.date ? formatTrendTooltipDate(row.date, period) : "";
              }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
                direction: "rtl",
              }}
            />
            {(!showOrderBreakdown || visibleSeries.value) && (
              <Line
                type="monotone"
                dataKey="value"
                stroke={metric.accent}
                strokeWidth={2.5}
                dot={{ r: 3, fill: metric.accent }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name={metric.title}
              />
            )}
            {showOrderBreakdown && visibleSeries.shippedOrders ? (
              <Line
                type="monotone"
                dataKey="shippedOrders"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name="تم الشحن"
              >
                {showPointLabels ? (
                  <LabelList
                    dataKey="shippedLabel"
                    content={(props) => (
                      <TrendShareLabel {...props} fill="#2563eb" position="top" />
                    )}
                  />
                ) : null}
              </Line>
            ) : null}
            {showOrderBreakdown && visibleSeries.successfulOrders ? (
              <Line
                type="monotone"
                dataKey="successfulOrders"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#8b5cf6" }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name="تم التسليم"
              >
                {showPointLabels ? (
                  <LabelList
                    dataKey="successfulLabel"
                    content={(props) => (
                      <TrendShareLabel
                        {...props}
                        fill="#7c3aed"
                        position="bottom"
                      />
                    )}
                  />
                ) : null}
              </Line>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {chartData.length === 0 ? (
        <p className="dashboard-donut-empty-hint">
          لا توجد نقاط للفترة المحددة.
        </p>
      ) : null}
    </section>
  );
}

export const PRODUCT_SALES_METRIC_DEFS = [
  {
    key: "totalOrders",
    title: "عدد الأوردرات",
    accent: "#22c55e",
    formatSummary: (v) => Number(v ?? 0).toLocaleString("ar-EG"),
    formatTooltip: (v) => [
      Number(v ?? 0).toLocaleString("ar-EG"),
      "عدد الأوردرات",
    ],
  },
  {
    key: "totalUnits",
    title: "القطع المباعة",
    accent: "#0ea5e9",
    formatSummary: (v) => Math.round(Number(v ?? 0)).toLocaleString("ar-EG"),
    formatTooltip: (v) => [
      Math.round(Number(v ?? 0)).toLocaleString("ar-EG"),
      "القطع المباعة",
    ],
  },
  {
    key: "totalRevenue",
    title: "الإيراد",
    accent: "#eab308",
    formatSummary: (v) =>
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "الإيراد",
    ],
  },
];

export function ProductSalesLineChart({
  products,
  selectedProductId,
  onProductChange,
  metricKey,
  onMetricChange,
  granularity,
  onGranularityChange,
  truncated,
}) {
  const metric =
    PRODUCT_SALES_METRIC_DEFS.find((m) => m.key === metricKey) ??
    PRODUCT_SALES_METRIC_DEFS[0];

  const productList = Array.isArray(products) ? products : [];

  const selectedProduct = useMemo(() => {
    if (!productList.length) return null;
    if (selectedProductId) {
      const match = productList.find((p) => p.product_id === selectedProductId);
      if (match) return match;
    }
    return productList[0];
  }, [productList, selectedProductId]);

  const chartData = useMemo(() => {
    const points = filterPointsUpToToday(selectedProduct?.points);
    return points.map((p) => {
      const raw = p?.[metric.key];
      return {
        date: p?.date,
        dateLabel: formatTrendAxisDate(p?.date),
        value: raw == null || raw === "" ? null : Number(raw),
      };
    });
  }, [selectedProduct, metric.key]);

  const xTickInterval = useMemo(() => {
    const n = chartData.length;
    const maxTicks = 8;
    if (n <= maxTicks) return 0;
    return Math.max(0, Math.ceil(n / maxTicks) - 1);
  }, [chartData.length]);

  const summary = selectedProduct?.summary ?? {};

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-trend-chart dashboard-product-sales-chart">
      <header className="dashboard-chart-card__header dashboard-trend-chart__header">
        <div>
          <h3>مبيعات المنتجات</h3>
          <p>تطور مبيعات المنتج خلال الفترة المحددة</p>
        </div>
        <div className="dashboard-product-sales-chart__controls">
          <label className="dashboard-trend-chart__metric-select">
            <span>المنتج</span>
            <select
              value={selectedProduct?.product_id ?? ""}
              onChange={(e) => onProductChange(e.target.value)}
              disabled={productList.length === 0}
              aria-label="اختيار المنتج"
            >
              {productList.length === 0 ? (
                <option value="">لا توجد منتجات</option>
              ) : (
                productList.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ""} —{" "}
                    {Math.round(
                      Number(product.summary?.totalUnits ?? 0),
                    ).toLocaleString("ar-EG")}{" "}
                    قطعة
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="dashboard-trend-chart__metric-select">
            <span>المؤشر</span>
            <select
              value={metric.key}
              onChange={(e) => onMetricChange(e.target.value)}
              aria-label="اختيار مؤشر مبيعات المنتج"
            >
              {PRODUCT_SALES_METRIC_DEFS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {selectedProduct ? (
        <div className="dashboard-product-sales-chart__summary">
          <span>
            الطلبات:{" "}
            <strong>
              {Number(summary.totalOrders ?? 0).toLocaleString("ar-EG")}
            </strong>
          </span>
          <span>
            القطع:{" "}
            <strong>
              {Math.round(Number(summary.totalUnits ?? 0)).toLocaleString(
                "ar-EG",
              )}
            </strong>
          </span>
          <span>
            الإيراد:{" "}
            <strong>
              {Math.round(Number(summary.totalRevenue ?? 0)).toLocaleString(
                "ar-EG",
              )}{" "}
              ج.م
            </strong>
          </span>
        </div>
      ) : null}

      <div className="dashboard-recharts-wrap dashboard-trend-chart__wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 20, left: 4, bottom: 52 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e8edf5"
            />
            <XAxis
              dataKey="dateLabel"
              tick={TrendXAxisTick}
              interval={xTickInterval}
              minTickGap={28}
              height={52}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
              tickFormatter={formatTrendYAxisTick}
              width={52}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => metric.formatTooltip(v)}
              labelFormatter={(_l, payload) => {
                const row = payload?.[0]?.payload;
                return row?.date ? formatTrendTooltipDate(row.date) : "";
              }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
                direction: "rtl",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metric.accent}
              strokeWidth={2.5}
              dot={{ r: 3, fill: metric.accent }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {chartData.length === 0 ? (
        <p className="dashboard-donut-empty-hint">
          لا توجد نقاط للفترة المحددة.
        </p>
      ) : null}
      {truncated ? (
        <p className="dashboard-donut-empty-hint">
          تم عرض جزء من المنتجات فقط — اختاري منتجاً محدداً لعرض تفاصيله.
        </p>
      ) : null}
    </section>
  );
}

export const ORDER_COST_SERIES_DEFS = [
  {
    key: "orders",
    title: "كل الطلبات",
    accent: "#3b82f6",
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "تكلفة الطلب (كل الحالات)",
    ],
  },
  {
    key: "shipped",
    title: "تم الشحن",
    accent: "#8b5cf6",
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "تكلفة الطلب (تم الشحن)",
    ],
  },
  {
    key: "delivered",
    title: "تم التوصيل",
    accent: "#22c55e",
    formatTooltip: (v) => [
      `${Math.round(Number(v ?? 0)).toLocaleString("ar-EG")} ج.م`,
      "تكلفة الطلب (تم التوصيل)",
    ],
  },
];

export function resolveOrderCostPointBlock(point, seriesKey) {
  if (!point || typeof point !== "object") return null;
  const key = normalizeOrderCostSeriesKey(seriesKey);
  if (point[key]) return point[key];
  if (key === "delivered" && point.successful) return point.successful;
  return null;
}

export function normalizeOrderCostSeriesKey(seriesKey) {
  const key = String(seriesKey ?? "orders");
  if (key === "successful") return "delivered";
  if (ORDER_COST_SERIES_DEFS.some((s) => s.key === key)) return key;
  return "orders";
}

export function resolveOrderCostSummaryBlock(summary, seriesKey) {
  if (!summary || typeof summary !== "object") return null;
  const key = normalizeOrderCostSeriesKey(seriesKey);
  if (summary[key]) return summary[key];
  if (key === "delivered" && summary.successful) return summary.successful;
  return null;
}

/** ملخص الفترة من النقاط عندما الـ API لا يرسل summary */
export function computeOrderCostPeriodSummary(points, seriesKey) {
  const list = Array.isArray(points) ? points : [];
  const key = normalizeOrderCostSeriesKey(seriesKey);
  let totalOrders = 0;
  let totalExpense = 0;
  let savedDaysOrders = 0;
  let savedDaysCount = 0;
  for (const p of list) {
    const block = resolveOrderCostPointBlock(p, key);
    const orders = Number(block?.totalOrders ?? 0);
    totalOrders += orders;
    if (p?.expenseEntered) {
      totalExpense += Number(p?.expense ?? 0);
      savedDaysOrders += orders;
      savedDaysCount += 1;
    }
  }
  const costPerOrder =
    savedDaysOrders > 0 && totalExpense > 0
      ? totalExpense / savedDaysOrders
      : 0;
  return { totalOrders, costPerOrder, totalExpense, savedDaysCount };
}

const ORDER_COST_DATE_BASIS_LABELS = {
  created: "تاريخ الإنشاء",
  activity: "نشاط الطلب",
};

export function OrderCostLineChart({
  chart,
  seriesKey,
  onSeriesChange,
  dateBasis,
  onDateBasisChange,
  loading,
}) {
  const resolvedSeriesKey = normalizeOrderCostSeriesKey(seriesKey);
  const series =
    ORDER_COST_SERIES_DEFS.find((s) => s.key === resolvedSeriesKey) ??
    ORDER_COST_SERIES_DEFS[0];

  const chartData = useMemo(() => {
    const points = filterPointsUpToToday(chart?.points);
    return points.map((p) => {
      const block = resolveOrderCostPointBlock(p, series.key);
      const raw = block?.costPerOrder;
      return {
        date: p?.date,
        dateLabel: formatTrendAxisDate(p?.date),
        value: raw == null || raw === "" ? 0 : Number(raw),
        totalOrders: block?.totalOrders ?? 0,
        dayExpense: Number(p?.expense ?? 0),
        expenseEntered: Boolean(p?.expenseEntered),
      };
    });
  }, [chart?.points, series.key]);

  const xTickInterval = useMemo(() => {
    const n = chartData.length;
    const maxTicks = 8;
    if (n <= maxTicks) return 0;
    return Math.max(0, Math.ceil(n / maxTicks) - 1);
  }, [chartData.length]);

  const apiSummary = resolveOrderCostSummaryBlock(chart?.summary, series.key);
  const computed = useMemo(
    () => computeOrderCostPeriodSummary(chart?.points, series.key),
    [chart?.points, series.key],
  );
  const summary = apiSummary ?? {
    totalOrders: computed.totalOrders,
    costPerOrder: computed.costPerOrder,
  };
  const totalExpense = computed.totalExpense;
  const savedDaysCount = computed.savedDaysCount;
  const liveFilledDaysCount = Number(chart?.liveFilledDaysCount ?? 0);
  const resolvedDateBasis = chart?.dateBasis ?? dateBasis ?? "created";
  const dateBasisLabel =
    ORDER_COST_DATE_BASIS_LABELS[resolvedDateBasis] ?? resolvedDateBasis;

  return (
    <div className="dashboard-order-cost-chart">
      <header className="dashboard-order-cost-chart__head">
        <div>
          <h4>جراف تكلفة الطلب</h4>
          {chart?.formulaAr ? (
            <p className="dashboard-order-cost-chart__formula">
              {chart.formulaAr}
            </p>
          ) : (
            <p className="dashboard-order-cost-chart__formula">
              يوم مسجّل: مصروفات وتكلفة من السجل · يوم غير مسجّل: طلبات live
              وتكلفة 0{" · "}
              أساس التاريخ: {dateBasisLabel}
            </p>
          )}
        </div>
        <div className="dashboard-order-cost-chart__controls">
          <label className="dashboard-trend-chart__metric-select">
            <span>النوع</span>
            <select
              value={resolvedSeriesKey}
              onChange={(e) => onSeriesChange(e.target.value)}
              aria-label="نوع تكلفة الطلب"
            >
              {ORDER_COST_SERIES_DEFS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {onDateBasisChange ? (
            <label className="dashboard-trend-chart__metric-select">
              <span>أساس التاريخ</span>
              <select
                value={dateBasis ?? "created"}
                onChange={(e) => onDateBasisChange(e.target.value)}
                aria-label="أساس تاريخ الطلبات"
              >
                <option value="created">تاريخ الإنشاء</option>
                <option value="activity">نشاط الطلب</option>
              </select>
            </label>
          ) : null}
        </div>
      </header>

      <div className="dashboard-order-cost-chart__summary">
        <span>
          أيام بمصروفات محفوظة:{" "}
          <strong>{savedDaysCount.toLocaleString("ar-EG")}</strong>
        </span>
        <span>
          أيام live (بدون مصروفات):{" "}
          <strong>{liveFilledDaysCount.toLocaleString("ar-EG")}</strong>
        </span>
        <span>
          مصروفات محفوظة:{" "}
          <strong>
            {Math.round(totalExpense).toLocaleString("ar-EG")} ج.م
          </strong>
        </span>
        <span>
          طلبات الفترة:{" "}
          <strong>
            {Number(summary.totalOrders ?? 0).toLocaleString("ar-EG")}
          </strong>
        </span>
        <span>
          تكلفة الطلب (أيام مسجّلة):{" "}
          <strong>
            {Math.round(Number(summary.costPerOrder ?? 0)).toLocaleString(
              "ar-EG",
            )}{" "}
            ج.م
          </strong>
        </span>
      </div>

      {loading ? (
        <p className="dashboard-donut-empty-hint">جاري تحميل الجراف...</p>
      ) : (
        <div className="dashboard-recharts-wrap dashboard-trend-chart__wrap dashboard-order-cost-chart__wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 20, left: 4, bottom: 52 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e8edf5"
              />
              <XAxis
                dataKey="dateLabel"
                tick={TrendXAxisTick}
                interval={xTickInterval}
                minTickGap={28}
                height={52}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                tickFormatter={formatTrendYAxisTick}
                width={52}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => series.formatTooltip(v)}
                labelFormatter={(_l, payload) => {
                  const row = payload?.[0]?.payload;
                  if (!row?.date) return "";
                  const orders = Number(row.totalOrders ?? 0).toLocaleString(
                    "ar-EG",
                  );
                  if (row.expenseEntered) {
                    const exp = Math.round(
                      Number(row.dayExpense ?? 0),
                    ).toLocaleString("ar-EG");
                    return `${formatTrendTooltipDate(row.date)} · ${orders} طلب · مصروفات ${exp} ج.م (مسجّل)`;
                  }
                  return `${formatTrendTooltipDate(row.date)} · ${orders} طلب (live · بدون مصروفات)`;
                }}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
                  direction: "rtl",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={series.accent}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const fill = payload?.expenseEntered
                    ? series.accent
                    : "#94a3b8";
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={fill}
                      stroke={fill}
                      strokeWidth={0}
                    />
                  );
                }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && chartData.length === 0 ? (
        <p className="dashboard-donut-empty-hint">
          لا توجد نقاط للفترة المحددة.
        </p>
      ) : null}
    </div>
  );
}

export function firstBucketValue(obj, keys) {
  if (!obj || typeof obj !== "object") return 0;
  const lowerMap = {};
  for (const [k, v] of Object.entries(obj)) {
    lowerMap[String(k).toLowerCase()] = v;
  }
  for (const k of keys) {
    const raw = obj[k] ?? lowerMap[String(k).toLowerCase()];
    if (raw != null && raw !== "") return Number(raw) || 0;
  }
  return 0;
}

const STATUS_BAR_DEFS = [
  { keys: ["new", "newOrders"], label: "تحت المراجعة", fill: "#3b82f6" },
  {
    keys: ["canceled", "cancelled", "canceled"],
    label: "ملغي",
    fill: "#ef4444",
  },
  {
    keys: ["no_replay", "noReplay", "no_reply"],
    label: "لا رد",
    fill: "#eab308",
  },
  {
    keys: ["follow_up", "followUp", "follow up"],
    label: "متابعة",
    fill: "#a855f7",
  },
  {
    keys: ["Shipped", "shipped", "shippedOrders"],
    label: "تم الشحن",
    fill: "#22c55e",
  },
];

/** نص المحور السفلي: عناصر SVG الافتراضية تعرض العربية معكوسة ومفككة — نعرضها داخل HTML بـ dir=rtl. */
function ArabicBarCategoryTick({ x, y, payload }) {
  const label = String(payload?.value ?? "");
  const w = 96;
  const h = 44;
  return (
    <foreignObject
      x={x - w / 2}
      y={y - 2}
      width={w}
      height={h}
      style={{ overflow: "visible" }}
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        dir="rtl"
        lang="ar"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "#64748b",
          lineHeight: 1.35,
          fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
          padding: "2px 4px 0",
        }}
      >
        {label}
      </div>
    </foreignObject>
  );
}

export function OrdersStatusBarChart({ byOrderStatus }) {
  const chartData = useMemo(() => {
    return STATUS_BAR_DEFS.map((row) => ({
      name: row.label,
      value: firstBucketValue(byOrderStatus, row.keys),
      fill: row.fill,
    }));
  }, [byOrderStatus]);

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel">
      <header className="dashboard-chart-card__header">
        <h3>حالات الطلبات</h3>
        <p>عدد الطلبات لكل حالة خلال الفترة المحددة</p>
      </header>
      <div className="dashboard-recharts-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -8, bottom: 8 }}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e8edf5"
            />
            <XAxis
              dataKey="name"
              type="category"
              tick={ArabicBarCategoryTick}
              interval={0}
              height={52}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              width={36}
              axisLine={false}
            />
            <Tooltip
              formatter={(v) => [Number(v).toLocaleString("ar-EG"), "الطلبات"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={52}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const DONUT_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#0ea5e9",
  "#64748b",
];

const PRODUCT_ORDERS_DONUT_PALETTE = [
  "#0d9488",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#3b82f6",
  "#64748b",
  "#a855f7",
  "#f97316",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
  "#6366f1",
];

const PRODUCT_DONUT_TOP_N = 10;

/** Donut segments: each product's share of total orders in the period. */
export function buildProductOrdersDonutSegments(
  products,
  { maxSlices = PRODUCT_DONUT_TOP_N } = {},
) {
  const list = Array.isArray(products) ? products : [];
  const rows = list
    .map((p, i) => ({
      key: String(p.product_id ?? p.id ?? i),
      name: String(p.name ?? p.sku ?? "منتج").trim() || "منتج",
      value: Number(p.summary?.totalOrders ?? p.totalOrders ?? 0),
      fill: PRODUCT_ORDERS_DONUT_PALETTE[
        i % PRODUCT_ORDERS_DONUT_PALETTE.length
      ],
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (rows.length <= maxSlices) return rows;

  const top = rows.slice(0, maxSlices);
  const rest = rows.slice(maxSlices);
  const otherValue = rest.reduce((s, r) => s + r.value, 0);
  if (otherValue > 0) {
    top.push({
      key: "__other__",
      name: `أخرى (${rest.length} منتج)`,
      value: otherValue,
      fill: "#94a3b8",
    });
  }
  return top;
}

export function ProductOrdersDonutCard({ products, truncated }) {
  const segments = useMemo(
    () => buildProductOrdersDonutSegments(products),
    [products],
  );

  return (
    <div className="dashboard-product-orders-donut-wrap">
      <OrdersDonutCard
        title="توزيع الطلبات حسب المنتج"
        subtitle="نسبة طلبات كل منتج من إجمالي الطلبات في الفترة"
        segments={segments}
      />
      {truncated ? (
        <p className="dashboard-donut-empty-hint dashboard-product-orders-donut__truncated">
          الدونات تعكس المنتجات المُرجَعة في الاستجابة فقط.
        </p>
      ) : null}
    </div>
  );
}

/** دمج مفاتيح مكررة في stats (مثل new و newOrders) لقطعة واحدة في الدونات. */
export const ORDER_STATUS_DONUT_DEFS = [
  {
    key: "new",
    keys: ["new", "newOrders"],
    label: "قيد المراجعة",
    fill: "#3b82f6",
  },
  {
    key: "canceled",
    keys: ["canceled", "cancelled", "canceledOrders"],
    label: "لاغي",
    fill: "#ef4444",
  },
  {
    key: "no_replay",
    keys: ["no_replay", "noReplyOrders"],
    label: "لا يرد",
    fill: "#eab308",
  },
  {
    key: "follow_up",
    keys: ["follow_up", "followUpOrders"],
    label: "متابعة",
    fill: "#a855f7",
  },
  {
    key: "repeater",
    keys: ["repeater", "repeaterOrders"],
    label: "مكرر",
    fill: "#64748b",
  },
  {
    key: "confirmed",
    keys: ["Confirmed", "confirmedOrders"],
    label: "تم التأكيد",
    fill: "#16a085",
  },
  {
    key: "shipped",
    keys: ["Shipped", "shippedOrders"],
    label: "تم الشحن",
    fill: "#22c55e",
  },
];

export const ORDER_SOURCE_DONUT_DEFS = [
  { key: "store", label: "متجر", fill: "#3b82f6" },
  { key: "messenger", label: "ماسنجر", fill: "#a855f7" },
  { key: "whatsapp", label: "واتساب", fill: "#22c55e" },
  { key: "lost_order", label: "طلب ضائع", fill: "#f97316" },
  { key: "old_customer", label: "عميل قديم", fill: "#0ea5e9" },
];

export const ORDER_TYPE_DONUT_DEFS = [
  { key: "new", label: "أوردر جديد", fill: "#3b82f6" },
  { key: "replacement", label: "استبدال", fill: "#eab308" },
  { key: "return", label: "مرتجع", fill: "#ef4444" },
];

export const SHIPPING_STATUS_DONUT_DEFS = [
  { key: "in_progress", label: "قيد التنفيذ", fill: "#3b82f6" },
  { key: "delivered", label: "تم التسليم", fill: "#22c55e" },
  { key: "failed", label: "فشل", fill: "#ef4444" },
];

export function buildDonutSegments(defs, raw) {
  const list = Array.isArray(defs) ? defs : [];
  return list.map((d) => ({
    key: d.key,
    name: d.label,
    fill: d.fill,
    value: firstBucketValue(raw, d.keys ?? [d.key]),
  }));
}

function rowsFromSegments(segments) {
  const list = Array.isArray(segments) ? segments : [];
  const total = list.reduce((s, e) => s + (Number(e.value) || 0), 0);
  const rows = list
    .map((e) => ({
      ...e,
      pct: total > 0 ? Math.round(((Number(e.value) || 0) / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const pieRows = rows.filter((r) => r.value > 0);
  const top = pieRows[0] ?? rows[0];
  const centerPct = top && total > 0 ? top.pct : 0;
  return { rows, pieRows, total, centerPct };
}

function bucketToDonutRows(data, labelForKey) {
  const entries = Object.entries(
    data && typeof data === "object" ? data : {},
  ).map(([key, val]) => ({
    key,
    name: labelForKey(key) || key,
    value: Number(val) || 0,
  }));
  const total = entries.reduce((s, e) => s + e.value, 0);
  const rows = entries
    .map((e, i) => ({
      ...e,
      fill: DONUT_PALETTE[i % DONUT_PALETTE.length],
      pct: total > 0 ? Math.round((e.value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const pieRows = rows.filter((r) => r.value > 0);
  const top = pieRows[0] ?? rows[0];
  const centerPct = top && total > 0 ? top.pct : 0;
  return { rows, pieRows, total, centerPct };
}

export function OrdersDonutCard({
  title,
  subtitle,
  data,
  labelForKey,
  segments,
}) {
  const { rows, pieRows, total, centerPct } = useMemo(() => {
    if (Array.isArray(segments) && segments.length > 0) {
      return rowsFromSegments(segments);
    }
    return bucketToDonutRows(data, labelForKey);
  }, [data, labelForKey, segments]);

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel">
      <header className="dashboard-chart-card__header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="dashboard-donut-layout">
        <div className="dashboard-donut-chart">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={
                  pieRows.length > 0
                    ? pieRows
                    : [{ value: 1, fill: "#e2e8f0", name: "—" }]
                }
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={pieRows.length > 1 ? 1 : 0}
                strokeWidth={0}
              >
                {(pieRows.length > 0
                  ? pieRows
                  : [{ key: "empty", fill: "#e2e8f0" }]
                ).map((entry, index) => (
                  <Cell key={entry.key ?? index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => {
                  const p = item?.payload;
                  return [
                    `${Number(value).toLocaleString("ar-EG")} (${p?.pct ?? 0}%)`,
                    p?.name ?? "",
                  ];
                }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-donut-center" aria-hidden="true">
            <span className="dashboard-donut-center__pct">{centerPct}%</span>
          </div>
        </div>
        <ul className="dashboard-donut-legend">
          {rows.map((row) => (
            <li key={row.key} className="dashboard-donut-legend__item">
              <span
                className="dashboard-donut-legend__swatch"
                style={{ background: row.fill }}
              />
              <span className="dashboard-donut-legend__name">{row.name}</span>
              <span className="dashboard-donut-legend__meta">
                {row.value.toLocaleString("ar-EG")}{" "}
                <span className="dashboard-donut-legend__pct">
                  ({row.pct}%)
                </span>
              </span>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="dashboard-donut-legend__empty">لا توجد بيانات</li>
          ) : null}
        </ul>
      </div>
      {total === 0 ? (
        <p className="dashboard-donut-empty-hint">
          لا طلبات في هذه الفئة للفترة.
        </p>
      ) : null}
    </section>
  );
}
