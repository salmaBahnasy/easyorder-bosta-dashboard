import { useMemo } from "react";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("ar-EG")} ج.م`;
}

function formatNumber(value, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-EG", options);
}

function formatRatio(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function MetricBlock({ block, accent }) {
  if (!block) {
    return (
      <article className="dashboard-order-costs__card">
        <p className="dashboard-order-costs__empty">لا توجد بيانات</p>
      </article>
    );
  }

  const rows = [
    { label: "عدد الطلبات", value: formatNumber(block.totalOrders) },
    { label: "إجمالي المبيعات", value: formatMoney(block.totalSales) },
    { label: "متوسط المبيعات / طلب", value: formatMoney(block.salesPerOrder) },
    {
      label: "تكلفة الطلب",
      value: formatMoney(block.costPerOrder),
      highlight: true,
    },
    { label: "عائد على الإنفاق", value: `${formatRatio(block.salesPerExpense)}×` },
  ];

  return (
    <article className="dashboard-order-costs__card" style={{ "--cost-accent": accent }}>
      <header className="dashboard-order-costs__card-head">
        <h4>{block.labelAr ?? "—"}</h4>
      </header>
      <dl className="dashboard-order-costs__metrics">
        {rows.map((row) => (
          <div
            key={row.label}
            className={
              row.highlight
                ? "dashboard-order-costs__metric dashboard-order-costs__metric--highlight"
                : "dashboard-order-costs__metric"
            }
          >
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default function OrderCostsSection({
  expense,
  onExpenseChange,
  onCalculate,
  loading,
  error,
  metrics,
  successfulShippingStatus,
  periodHint,
}) {
  const expenseNum = Number(expense);
  const canCalculate = Number.isFinite(expenseNum) && expenseNum >= 0 && String(expense).trim() !== "";

  const periodText = useMemo(() => {
    if (periodHint) return periodHint;
    return "الشهر الحالي (افتراضي)";
  }, [periodHint]);

  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-order-costs">
      <header className="dashboard-chart-card__header dashboard-order-costs__header">
        <div>
          <h3>تكلفة الطلبات</h3>
          <p>حساب تكلفة الطلب المشحون والناجح بناءً على المصروفات</p>
        </div>
        <div className="dashboard-order-costs__controls">
          <label className="dashboard-order-costs__expense-field">
            <span>المصروفات (ج.م)</span>
            <input
              type="number"
              min={0}
              step="1"
              className="dashboard-order-costs__expense-input"
              value={expense}
              onChange={(e) => onExpenseChange(e.target.value)}
              placeholder="مثال: 10000"
              aria-label="المصروفات"
            />
          </label>
          <button
            type="button"
            className="dashboard-refresh-btn dashboard-order-costs__calc-btn"
            onClick={onCalculate}
            disabled={loading || !canCalculate}
          >
            {loading ? "جاري الحساب..." : "احسب التكلفة"}
          </button>
        </div>
      </header>

      <p className="dashboard-order-costs__period">
        الفترة: <strong>{periodText}</strong>
        {successfulShippingStatus ? (
          <>
            {" "}
            · الطلب الناجح:{" "}
            <strong>{successfulShippingStatus === "delivered" ? "تم التسليم" : successfulShippingStatus}</strong>
          </>
        ) : null}
      </p>

      {error ? <p className="dashboard-order-costs__error">{error}</p> : null}

      {metrics ? (
        <div className="dashboard-order-costs__grid">
          <MetricBlock block={metrics.shipped} accent="#3b82f6" />
          <MetricBlock block={metrics.successful} accent="#22c55e" />
        </div>
      ) : !loading && !error ? (
        <p className="dashboard-order-costs__hint">
          أدخلي المصروفات واضغطي «احسب التكلفة» — تُستخدم تواريخ الفلتر أعلاه إن وُجدت.
        </p>
      ) : null}
    </section>
  );
}
