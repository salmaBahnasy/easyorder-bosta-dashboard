import {
  orderCartProductLines,
  orderCustomer,
  orderDate,
  orderDisplayId,
  orderPhone,
  orderRowKey,
  orderShippingStatus,
  orderStatus,
  orderUpdatedByName,
} from "../utils/orderDisplay";
import "./OrdersTable.css";

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function isShippedOrderStatus(order) {
  const raw = orderStatus(order);
  const n = normalizeStatus(raw);
  if (n === "shipped") return true;
  return String(raw ?? "").trim() === "تم الشحن";
}

function shippingStatusDisplayLabel(code) {
  if (code == null || code === "") return null;
  const key = String(code).trim().toLowerCase();
  const map = {
    in_progress: "قيد التنفيذ",
    delivered: "تم التسليم",
    failed: "فشل",
  };
  return map[key] ?? String(code);
}

function getStatusPresentation(value) {
  const normalized = normalizeStatus(value);
  const map = {
    new: { label: "قيد المراجعة", tone: "gray" },
    جديد: { label: "قيد المراجعة", tone: "gray" },
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
            <th>آخر تحديث بواسطة</th>
            <th>إجراء</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order, index) => {
            const productLines = orderCartProductLines(order);
            const statusView = getStatusPresentation(orderStatus(order));
            const shipCode = orderShippingStatus(order);
            const shipLabel = shippingStatusDisplayLabel(shipCode);
            const showShippingWithStatus = isShippedOrderStatus(order) && shipLabel;
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
                  <div className="orders-table__status-cell">
                    <span className={`orders-table__badge orders-table__badge--${statusView.tone}`}>
                      {statusView.label}
                    </span>
                    {showShippingWithStatus ? (
                      <span className="orders-table__shipping-beside" title="حالة الشحن">
                        · {shipLabel}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="orders-table__product-cell">
                  {productLines.length === 0 ? (
                    <strong>—</strong>
                  ) : (
                    <ul className="orders-table__product-list">
                      {productLines.map((line, lineIdx) => (
                        <li key={`${orderRowKey(order, index)}-p-${lineIdx}`}>
                          <p>{line.name}</p>
                          {line.quantity != null ? (
                            <span className="orders-table__product-qty">
                              {" "}
                              ×{line.quantity}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>{formatDateTime(orderDate(order))}</td>
                <td className="orders-table__updated-by">
                  {orderUpdatedByName(order)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="orders-table__actions">
                   
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
