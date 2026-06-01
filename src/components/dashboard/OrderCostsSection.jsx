import { OrderCostLineChart } from "./DashboardCharts";

export default function OrderCostsSection({
  expense,
  onExpenseChange,
  onCalculate,
  error,
  orderCostChart,
  orderCostChartLoading,
  orderCostSeries,
  onOrderCostSeriesChange,
  orderCostGranularity,
  onOrderCostGranularityChange,
  orderCostDateBasis,
  onOrderCostDateBasisChange,
}) {
  return (
    <section className="dashboard-chart-card dashboard-chart-card--panel dashboard-order-costs">
      <header className="dashboard-chart-card__header dashboard-order-costs__header">
        <div>
          <h3>تكلفة الطلبات</h3>
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
            disabled={orderCostChartLoading}
          >
            {orderCostChartLoading ? "جاري الحساب..." : "احسب التكلفة"}
          </button>
        </div>
      </header>

      {error ? <p className="dashboard-order-costs__error">{error}</p> : null}

      <OrderCostLineChart
        chart={orderCostChart}
        seriesKey={orderCostSeries}
        onSeriesChange={onOrderCostSeriesChange}
        granularity={orderCostGranularity}
        onGranularityChange={onOrderCostGranularityChange}
        dateBasis={orderCostDateBasis}
        onDateBasisChange={onOrderCostDateBasisChange}
        loading={orderCostChartLoading}
      />
    </section>
  );
}
