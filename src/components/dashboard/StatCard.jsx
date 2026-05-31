export default function StatCard({
  title,
  value,
  changeText,
  icon,
  accent = "#5B6FB6",
  trendPercent,
}) {
  const hasTrend = typeof trendPercent === "number" && !Number.isNaN(trendPercent);
  const trendUp = hasTrend && trendPercent >= 0;

  return (
    <article className="dashboard-stat-card dashboard-stat-card--v2">
      <div className="dashboard-stat-card__head">
        <span className="dashboard-stat-card__title">{title}</span>
        <span
          className="dashboard-stat-card__icon dashboard-stat-card__icon--round"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="dashboard-stat-card__value">{value}</p>
      {hasTrend ? (
        <p className={`dashboard-stat-card__trend ${trendUp ? "is-up" : "is-down"}`}>
          <span className="dashboard-stat-card__trend-num">
            {trendUp ? "+" : ""}
            {trendPercent}%
          </span>
          <span className="dashboard-stat-card__footnote">من الفترة السابقة</span>
        </p>
      ) : (
        <p className="dashboard-stat-card__footnote">{changeText}</p>
      )}
    </article>
  );
}
