import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  const top = rows[0];
  const centerPct = top && total > 0 ? Math.round((top.value / total) * 100) : 0;
  return { rows, total, centerPct };
}

export function OrdersDonutCard({ title, subtitle, data, labelForKey }) {
  const { rows, total, centerPct } = useMemo(
    () => bucketToDonutRows(data, labelForKey),
    [data, labelForKey],
  );

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
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={1}
                strokeWidth={0}
              >
                {rows.map((entry, index) => (
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
