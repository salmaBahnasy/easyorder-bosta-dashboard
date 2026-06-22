export default function ChartCard({ title, subtitle, children }) {
  return (
    <section className="dashboard-chart-card">
      <header className="dashboard-chart-card__header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
