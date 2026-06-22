import { OrderCostLineChart } from "./DashboardCharts";

export default function OrderCostsSection({
  expense,
  saveDate,
  onExpenseChange,
  onSaveDateChange,
  onSave,
  saving,
  successMessage,
  chartPeriodHint,
  error,
  orderCostChart,
  orderCostChartLoading,
  orderCostSeries,
  onOrderCostSeriesChange,
  orderCostDateBasis,
  onOrderCostDateBasisChange,
}) {
  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-order-costs">
      <header className="dashboard-chart-card__header dashboard-order-costs__header">
        <div>
          <h3>تكلفة الطلبات</h3>
          {chartPeriodHint ? (
            <p className="dashboard-order-costs__period-hint">{chartPeriodHint}</p>
          ) : null}
        </div>
        <div className="dashboard-order-costs__controls">
          <label className="dashboard-order-costs__expense-field">
            <span>تاريخ اليوم</span>
            <input
              type="date"
              className="dashboard-order-costs__expense-input"
              value={saveDate}
              onChange={(e) => onSaveDateChange(e.target.value)}
              aria-label="تاريخ اليوم"
            />
          </label>
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
            onClick={onSave}
            disabled={saving || orderCostChartLoading}
          >
            {saving ? "جاري الحفظ..." : "احسب وحفظ"}
          </button>
        </div>
      </header>

      {error ? <p className="dashboard-order-costs__error">{error}</p> : null}
      {successMessage ? (
        <p className="dashboard-order-costs__success">{successMessage}</p>
      ) : null}

      <OrderCostLineChart
        chart={orderCostChart}
        seriesKey={orderCostSeries}
        onSeriesChange={onOrderCostSeriesChange}
        dateBasis={orderCostDateBasis}
        onDateBasisChange={onOrderCostDateBasisChange}
        loading={orderCostChartLoading}
      />
    </section>
  );
}
