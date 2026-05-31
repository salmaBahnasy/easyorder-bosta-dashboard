export default function LatestOrdersTable({ rows }) {
  return (
    <section className="dashboard-table-card">
      <header className="dashboard-chart-card__header">
        <h3>آخر الطلبات</h3>
        <p>آخر الطلبات القادمة من النظام</p>
      </header>
      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>الحالة</th>
              <th>القيمة</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.status}</td>
                <td>{row.amount}</td>
                <td>{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
