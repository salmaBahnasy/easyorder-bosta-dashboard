import { useEffect, useRef } from "react";
import {
  orderCartProductLines,
  orderCustomer,
  orderDate,
  orderHasNote,
  orderNote,
  orderReferenceDisplay,
  orderPhone,
  orderRowKey,
  orderShippingStatus,
  orderStatus,
  orderType,
  orderTypeDisplayLabel,
  orderUpdatedByName,
} from "../utils/orderDisplay";
import {
  buildWhatsAppConfirmMessage,
  buildWhatsAppSendUrl,
  sanitizeWhatsAppText,
} from "../utils/whatsapp";
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

function WhatsAppIcon() {
  return (
    <svg
      className="orders-table__whatsapp-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function OrdersTable({
  orders,
  onViewDetails,
  onCopyCustomer,
  highlightOrderId,
}) {
  const highlightRowRef = useRef(null);

  useEffect(() => {
    if (!highlightOrderId || !highlightRowRef.current) return;
    highlightRowRef.current.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [highlightOrderId, orders]);
  const openWhatsAppConfirm = (order) => {
    let phone = String(order?.phone || "").replace(/\D/g, "");

    // تحويل الرقم المصري
    if (phone.startsWith("0")) {
      phone = `2${phone}`;
    }

    const productsText =
      order?.cart_items && Array.isArray(order.cart_items)
        ? order.cart_items
            .map((item) => {
              const name = sanitizeWhatsAppText(
                item?.product?.name ||
                  item?.name ||
                  item?.productName ||
                  item?.title ||
                  "منتج",
              );

              const qty = item?.quantity || item?.qty || 1;
              const price = item?.price || item?.product?.price || 0;

              return `• ${name} × ${qty} - ${price} جنيه`;
            })
            .join("\n")
        : "• منتج × 1";

    const message = buildWhatsAppConfirmMessage(order, productsText);
    const whatsappUrl = buildWhatsAppSendUrl(phone, message);

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };
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
            const rowKey = orderRowKey(order, index);
            const productLines = orderCartProductLines(order);
            const statusView = getStatusPresentation(orderStatus(order));
            const typeLabel = orderTypeDisplayLabel(orderType(order));
            const shipCode = orderShippingStatus(order);
            const shipLabel = shippingStatusDisplayLabel(shipCode);
            const showShippingWithStatus =
              isShippedOrderStatus(order) && shipLabel;
            const isHighlighted =
              highlightOrderId && rowKey === highlightOrderId;
            return (
              <tr
                key={rowKey}
                ref={isHighlighted ? highlightRowRef : null}
                onClick={() => onViewDetails(order, index)}
                className={
                  isHighlighted
                    ? "orders-table__row orders-table__row--highlighted"
                    : "orders-table__row"
                }
                title="اضغطي لفتح تفاصيل الطلب"
              >
                <td>
                  <div className="orders-table__ref-cell">
                    <span>{orderReferenceDisplay(order)}</span>
                    {orderHasNote(order) ? (
                      <span
                        className="orders-table__badge orders-table__badge--note"
                        title={orderNote(order)}
                      >
                        ملاحظة
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>{orderCustomer(order)}</td>
                <td>{orderPhone(order)}</td>
                <td>
                  <div className="orders-table__status-cell">
                    <span
                      className={`orders-table__badge orders-table__badge--${statusView.tone}`}
                    >
                      {statusView.label}
                    </span>
                    {typeLabel ? (
                      <span
                        className="orders-table__shipping-beside"
                        title="نوع الطلب"
                      >
                        · {typeLabel}
                      </span>
                    ) : null}
                    {showShippingWithStatus ? (
                      <span
                        className="orders-table__shipping-beside"
                        title="حالة الشحن"
                      >
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
                          {/* {line.quantity != null ? (
                            <span className="orders-table__product-qty">
                              {" "}
                              ×{line.quantity}
                            </span>
                          ) : null} */}
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
                    {onCopyCustomer ? (
                      <button
                        onClick={() => onCopyCustomer(order)}
                        type="button"
                        className="orders-table__icon-btn orders-table__icon-btn--copy"
                        title="نسخ بيانات العميل لطلب جديد"
                        aria-label="نسخ بيانات العميل لطلب جديد"
                      >
                        <span
                          className="orders-table__copy-icon"
                          aria-hidden="true"
                        >
                          ⧉
                        </span>
                      </button>
                    ) : null}
                    <button
                      onClick={() => onViewDetails(order, index)}
                      type="button"
                      className="orders-table__icon-btn"
                      title="تعديل الطلب"
                      aria-label="تعديل الطلب"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => openWhatsAppConfirm(order)}
                      type="button"
                      className="orders-table__icon-btn orders-table__icon-btn--whatsapp"
                      title="واتساب"
                      aria-label="فتح واتساب"
                    >
                      <WhatsAppIcon />
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
