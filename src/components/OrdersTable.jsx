import {
  orderCustomer,
  orderDate,
  orderDisplayId,
  orderPayment,
  orderPhone,
  orderProductBlock,
  orderQuantity,
  orderRowKey,
  orderStatus,
  orderTotalCost,
} from "../utils/orderDisplay";

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function getStatusPresentation(value) {
  const normalized = normalizeStatus(value);
  const map = {
    new: { label: "جديد", color: "#7f8c8d" },
    canceled: { label: "لاغي", color: "#e74c3c" },
    cancelled: { label: "لاغي", color: "#e74c3c" },
    "no replay": { label: "لا يرد", color: "#f39c12" },
    "no reply": { label: "لا يرد", color: "#f39c12" },
    "follow up": { label: "متابعة", color: "#3498db" },
    followup: { label: "متابعة", color: "#3498db" },
    repeater: { label: "مكرر", color: "#9b59b6" },
    duplicate: { label: "مكرر", color: "#9b59b6" },
    confirmed: { label: "تم التأكيد", color: "#16a085" },
    shipped: { label: "تم الشحن", color: "#27ae60" },
  };
  return map[normalized] ?? { label: value || "—", color: "#7f8c8d" };
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function OrdersTable({ orders, onViewDetails }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        border="1"
        cellPadding="10"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#fff",
        }}
      >
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>العميل</th>
            <th>الموبايل</th>
            <th>حالة الطلب</th>
            <th>المنتج</th>
            {/* <th>الكمية</th> */}
            {/* <th>الإجمالي</th> */}
            {/* <th>الدفع</th> */}
            <th>التاريخ</th>
            <th>إجراء</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order, index) => {
            const { name: productName, variant: productVariant } =
              orderProductBlock(order);
            const totalVal = orderTotalCost(order);
            const statusView = getStatusPresentation(orderStatus(order));
            return (
              <tr
                key={orderRowKey(order, index)}
                onClick={() => onViewDetails(order)}
                style={{ cursor: "pointer" }}
                title="اضغطي لفتح تفاصيل الطلب"
              >
                <td>{orderDisplayId(order)}</td>
                <td>{orderCustomer(order)}</td>
                <td>{orderPhone(order)}</td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: statusView.color,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusView.label}
                  </span>
                </td>
                <td style={{ minWidth: 220 }}>
                  <strong>{productName}</strong>
                  {productVariant ? (
                    <>
                      <br />
                      <small>{productVariant}</small>
                    </>
                  ) : null}
                </td>
                {/* <td>{orderQuantity(order)}</td> */}
                {/* <td>{totalVal != null ? `${totalVal} ج` : "—"}</td> */}
                {/* <td>{orderPayment(order)}</td> */}
                <td>{formatDateTime(orderDate(order))}</td>
                <td
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "default" }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onViewDetails(order)}
                      type="button"
                    >
                      تفاصيل الطلب
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
