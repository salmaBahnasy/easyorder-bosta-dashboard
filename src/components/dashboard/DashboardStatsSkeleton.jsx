import "./DashboardStatsSkeleton.css";

function SkeletonBone({ className = "", style }) {
  return (
    <span
      className={`dashboard-skeleton__bone ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );
}

function StatCardSkeleton() {
  return (
    <article className="dashboard-skeleton dashboard-skeleton--stat">
      <div className="dashboard-skeleton__stat-head">
        <SkeletonBone className="dashboard-skeleton__bone--title" />
        <SkeletonBone className="dashboard-skeleton__bone--icon" />
      </div>
      <SkeletonBone className="dashboard-skeleton__bone--value" />
      <SkeletonBone className="dashboard-skeleton__bone--footnote" />
    </article>
  );
}

export function TrendChartSkeleton() {
  return (
    <article className="dashboard-skeleton dashboard-skeleton--chart dashboard-chart-card dashboard-chart-card--panel dashboard-trend-chart">
      <header className="dashboard-skeleton__chart-head">
        <div className="dashboard-skeleton__chart-head-text">
          <SkeletonBone className="dashboard-skeleton__bone--chart-title" />
          <SkeletonBone className="dashboard-skeleton__bone--chart-subtitle" />
        </div>
        <SkeletonBone className="dashboard-skeleton__bone--select" />
      </header>
      <div className="dashboard-skeleton__chart-body">
        <div className="dashboard-skeleton__chart-y-axis">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBone key={index} className="dashboard-skeleton__bone--y-tick" />
          ))}
        </div>
        <div className="dashboard-skeleton__chart-plot">
          <svg
            className="dashboard-skeleton__chart-line"
            viewBox="0 0 400 160"
            preserveAspectRatio="none"
          >
            <path d="M0,120 C40,100 80,130 120,90 C160,50 200,110 240,70 C280,30 320,80 360,40 L400,60 L400,160 L0,160 Z" />
            <path d="M0,120 C40,100 80,130 120,90 C160,50 200,110 240,70 C280,30 320,80 360,40 L400,60" />
          </svg>
          <div className="dashboard-skeleton__chart-x-axis">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBone key={index} className="dashboard-skeleton__bone--x-tick" />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function DonutCardSkeleton() {
  return (
    <article className="dashboard-skeleton dashboard-skeleton--donut dashboard-chart-card dashboard-chart-card--panel">
      <header className="dashboard-skeleton__donut-head">
        <SkeletonBone className="dashboard-skeleton__bone--chart-title" />
        <SkeletonBone className="dashboard-skeleton__bone--chart-subtitle" />
      </header>
      <div className="dashboard-skeleton__donut-body">
        <SkeletonBone className="dashboard-skeleton__bone--donut-ring" />
        <div className="dashboard-skeleton__donut-legend">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dashboard-skeleton__donut-legend-row">
              <SkeletonBone className="dashboard-skeleton__bone--swatch" />
              <SkeletonBone className="dashboard-skeleton__bone--legend-text" />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function KpiCardsSkeleton({ count = 5 } = {}) {
  return (
    <section className="dashboard-kpis dashboard-kpis--5" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={`stat-${index}`} />
      ))}
    </section>
  );
}

export default function DashboardStatsSkeleton() {
  return (
    <div
      className="dashboard-stats-skeleton"
      aria-busy="true"
      aria-label="جاري تحميل الإحصائيات"
    >
      <KpiCardsSkeleton />

      <section className="dashboard-charts-row dashboard-charts-row--trend-pair">
        <TrendChartSkeleton />
        <TrendChartSkeleton />
      </section>

      <section className="dashboard-charts-row dashboard-charts-row--donuts">
        {Array.from({ length: 4 }).map((_, index) => (
          <DonutCardSkeleton key={`donut-${index}`} />
        ))}
      </section>
    </div>
  );
}
