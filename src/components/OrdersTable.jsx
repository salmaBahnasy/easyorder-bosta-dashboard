import {
  orderCustomer,
  orderDate,
  orderDisplayId,
  orderPhone,
  orderProductBlock,
  orderRowKey,
  orderStatus,
} from "../utils/orderDisplay";
import "./OrdersTable.css";

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
    new: { label: "جديد", tone: "gray" },
    canceled: { label: "لاغي", tone: "red" },
    cancelled: { label: "لاغي", tone: "red" },
    "no replay": { label: "لا يرد", tone: "yellow" },
    "no reply": { label: "لا يرد", tone: "yellow" },
    "follow up": { label: "متابعة", tone: "gray" },
    followup: { label: "متابعة", tone: "gray" },
    repeater: { label: "مكرر", tone: "gray" },
    duplicate: { label: "مكرر", tone: "gray" },
    confirmed: { label: "تم التأكيد", tone: "green" },
    shipped: { label: "تم الشحن", tone: "green" },
  };
  return map[normalized] ?? { label: value || "—", tone: "gray" };
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
    <div className="orders-table-wrap">
      <table className="orders-table">
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
            const statusView = getStatusPresentation(orderStatus(order));
            return (
              <tr
                key={orderRowKey(order, index)}
                onClick={() => onViewDetails(order)}
                className="orders-table__row"
                title="اضغطي لفتح تفاصيل الطلب"
              >
                <td>{orderDisplayId(order)}</td>
                <td>{orderCustomer(order)}</td>
                <td>{orderPhone(order)}</td>
                <td>
                  <span className={`orders-table__badge orders-table__badge--${statusView.tone}`}>
                    {statusView.label}
                  </span>
                </td>
                <td className="orders-table__product-cell">
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
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="orders-table__actions">
                    <button
                      onClick={() => onViewDetails(order)}
                      type="button"
                      className="orders-table__icon-btn"
                      title="عرض التفاصيل"
                      aria-label="عرض التفاصيل"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => onViewDetails(order)}
                      type="button"
                      className="orders-table__icon-btn"
                      title="تعديل الطلب"
                      aria-label="تعديل الطلب"
                    >
                      ✏️
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
