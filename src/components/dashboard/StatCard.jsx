export default function StatCard({ title, value, changeText, icon, accent = "#5B6FB6" }) {
  return (
    <article className="dashboard-stat-card">
      <div className="dashboard-stat-card__head">
        <span className="dashboard-stat-card__title">{title}</span>
        <span className="dashboard-stat-card__icon" style={{ backgroundColor: `${accent}1f` }}>
          {icon}
        </span>
      </div>
      <strong className="dashboard-stat-card__value">{value}</strong>
      <p className="dashboard-stat-card__change">{changeText}</p>
    </article>
  );
}
