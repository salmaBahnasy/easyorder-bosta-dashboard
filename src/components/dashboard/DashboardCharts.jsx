import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const TREND_METRIC_DEFS = [
  {
    key: "totalOrders",
    title: "عدد الطلبات",
    icon: "🛍️",
    accent: "#22c55e",
    formatSummary: (v) => Number(v ?? 0).toLocaleString("ar-EG"),
    formatTooltip: (v) => [Number(v ?? 0).toLocaleString("ar-EG"), "عدد الطلبات"],
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
    formatTooltip: (v) => [Math.round(Number(v ?? 0)).toLocaleString("ar-EG"), "عدد القطع"],
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

function formatTrendAxisDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${day}/${month}`;
}

function formatTrendTooltipDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function formatTrendYAxisTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}ك`;
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
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

export function OrdersTrendLineChart({ points, metricKey, onMetricChange }) {
  const metric =
    TREND_METRIC_DEFS.find((m) => m.key === metricKey) ?? TREND_METRIC_DEFS[0];

  const chartData = useMemo(() => {
    const list = Array.isArray(points) ? points : [];
    return list.map((p) => {
      const raw = p?.[metric.key];
      return {
        date: p?.date,
        dateLabel: formatTrendAxisDate(p?.date),
        value: raw == null || raw === "" ? null : Number(raw),
      };
    });
  }, [points, metric.key]);

  const xTickInterval = useMemo(() => {
    const n = chartData.length;
    const maxTicks = 8;
    if (n <= maxTicks) return 0;
    return Math.max(0, Math.ceil(n / maxTicks) - 1);
  }, [chartData.length]);

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-trend-chart">
      <header className="dashboard-chart-card__header dashboard-trend-chart__header">
        <div>
          <h3>اتجاه الأداء</h3>
          <p>تطور المؤشر خلال الفترة المحددة</p>
        </div>
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
      </header>
      <div className="dashboard-recharts-wrap dashboard-trend-chart__wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 20, left: 4, bottom: 52 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
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
        <p className="dashboard-donut-empty-hint">لا توجد نقاط للفترة المحددة.</p>
      ) : null}
    </section>
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
  { keys: ["canceled", "cancelled", "canceled"], label: "ملغي", fill: "#ef4444" },
  { keys: ["no_replay", "noReplay", "no_reply"], label: "لا رد", fill: "#eab308" },
  { keys: ["follow_up", "followUp", "follow up"], label: "متابعة", fill: "#a855f7" },
  { keys: ["Shipped", "shipped", "shippedOrders"], label: "تم الشحن", fill: "#22c55e" },
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
            <XAxis
              dataKey="name"
              type="category"
              tick={ArabicBarCategoryTick}
              interval={0}
              height={52}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={36} axisLine={false} />
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

const DONUT_PALETTE = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#0ea5e9", "#64748b"];

/** دمج مفاتيح مكررة في stats (مثل new و newOrders) لقطعة واحدة في الدونات. */
export const ORDER_STATUS_DONUT_DEFS = [
  { key: "new", keys: ["new", "newOrders"], label: "قيد المراجعة", fill: "#3b82f6" },
  { key: "canceled", keys: ["canceled", "cancelled", "canceledOrders"], label: "لاغي", fill: "#ef4444" },
  { key: "no_replay", keys: ["no_replay", "noReplyOrders"], label: "لا يرد", fill: "#eab308" },
  { key: "follow_up", keys: ["follow_up", "followUpOrders"], label: "متابعة", fill: "#a855f7" },
  { key: "repeater", keys: ["repeater", "repeaterOrders"], label: "مكرر", fill: "#64748b" },
  { key: "confirmed", keys: ["Confirmed", "confirmedOrders"], label: "تم التأكيد", fill: "#16a085" },
  { key: "shipped", keys: ["Shipped", "shippedOrders"], label: "تم الشحن", fill: "#22c55e" },
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
  const entries = Object.entries(data && typeof data === "object" ? data : {}).map(
    ([key, val]) => ({
      key,
      name: labelForKey(key) || key,
      value: Number(val) || 0,
    }),
  );
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

export function OrdersDonutCard({ title, subtitle, data, labelForKey, segments }) {
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
                data={pieRows.length > 0 ? pieRows : [{ value: 1, fill: "#e2e8f0", name: "—" }]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={pieRows.length > 1 ? 1 : 0}
                strokeWidth={0}
              >
                {(pieRows.length > 0 ? pieRows : [{ key: "empty", fill: "#e2e8f0" }]).map(
                  (entry, index) => (
                    <Cell key={entry.key ?? index} fill={entry.fill} />
                  ),
                )}
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
              <span className="dashboard-donut-legend__swatch" style={{ background: row.fill }} />
              <span className="dashboard-donut-legend__name">{row.name}</span>
              <span className="dashboard-donut-legend__meta">
                {row.value.toLocaleString("ar-EG")}{" "}
                <span className="dashboard-donut-legend__pct">({row.pct}%)</span>
              </span>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="dashboard-donut-legend__empty">لا توجد بيانات</li>
          ) : null}
        </ul>
      </div>
      {total === 0 ? <p className="dashboard-donut-empty-hint">لا طلبات في هذه الفئة للفترة.</p> : null}
    </section>
  );
}
