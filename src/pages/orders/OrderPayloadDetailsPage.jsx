import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getProducts, getZones, updateOrder, updateOrderStatus } from "../../api/ordersApi";
import {
  cartRowSelectValue,
  catalogProductDisplayName,
  createEmptyCartRow,
  parseProductRawData,
  productOptionId,
  productToCartFields,
  unwrapCatalogProduct,
} from "./cartCatalogHelpers";
import {
  orderAddress,
  orderCustomer,
  orderDisplayId,
  orderPayment,
  orderPhone,
} from "../../utils/orderDisplay";
import { getActiveUserDisplayName, resolveActorDisplayName } from "../../utils/orderAudit";
import { normalizeProductListFromApi } from "../../utils/normalizeProductListFromApi";
import "./OrderPayloadDetailsPage.css";

function cartRowFromOrderItem(item, idx) {
  const sku = String(
    item.sku ?? item.skuCode ?? item.product?.sku ?? ""
  );
  const name = String(
    item.name ??
      item.product_name ??
      item.title ??
      item.product?.name ??
      ""
  );
  const variant = String(item.variant ?? item.variant_name ?? item.variant_label ?? "");
  const quantity = Number(item.quantity ?? item.qty ?? 1) || 1;
  const price = Number(item.price ?? item.unitPrice ?? 0) || 0;
  const rawPid =
    item.product_id ?? item.productId ?? item.product?.id ?? item.product?._id;
  const rawStr = rawPid != null && rawPid !== "" ? String(rawPid).trim() : "";
  const num = Number(rawStr);
  const isPureNumericId =
    rawStr !== "" && Number.isFinite(num) && num > 0 && String(num) === rawStr;
  const catalogProductId = isPureNumericId ? num : null;
  const catalogProductKey = rawStr && !isPureNumericId ? rawStr : "";
  return {
    key: `line-${idx}-${sku || "sku"}-${price}-${quantity}`,
    sku,
    name,
    variant,
    quantity,
    price,
    catalogProductId,
    catalogProductKey,
    catalogOptionId: "",
  };
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

/** Parses money from controlled inputs (handles commas, spaces, partial input). */
function parseNonNegativeMoney(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  if (s === "" || s === "-" || s === "." || s === "-.") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const ORDER_STATUS_UI_OPTIONS = [
  { value: "جديد", label: "قيد المراجعة" },
  { value: "لاغي", label: "لاغي" },
  { value: "لا يرد", label: "لا يرد" },
  { value: "متابعة", label: "متابعة" },
  { value: "مكرر", label: "مكرر" },
  { value: "تم التأكيد", label: "تم التأكيد" },
  { value: "تم الشحن", label: "تم الشحن" },
];

const ORDER_SOURCE_OPTIONS = [
  { value: "store", label: "متجر" },
  { value: "messenger", label: "ماسنجر" },
  { value: "whatsapp", label: "واتساب" },
  { value: "lost_order", label: "طلب ضائع" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "new", label: "أوردر جديد" },
  { value: "replacement", label: "استبدال" },
  { value: "return", label: "مرتجع" },
];

function orderStatusUiLabel(statusValue) {
  if (statusValue == null || statusValue === "") return "—";
  const hit = ORDER_STATUS_UI_OPTIONS.find((o) => o.value === statusValue);
  return hit?.label ?? String(statusValue);
}

function orderTypeUiLabel(typeValue) {
  const key = String(typeValue ?? "").trim().toLowerCase();
  const hit = ORDER_TYPE_OPTIONS.find((o) => o.value === key);
  return hit?.label ?? String(typeValue ?? "—");
}

const SHIPPING_STATUS_OPTIONS = [
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "delivered", label: "تم التسليم" },
  { value: "failed", label: "فشل" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "COD", label: "COD (دفع عند الاستلام)" },
  { value: "Instapay", label: "إنستاباي" },
];

function normalizePaymentMethod(value) {
  const s = String(value ?? "").trim();
  if (!s) return "COD";
  const lower = s.toLowerCase();
  if (lower === "instapay" || lower === "insta pay" || lower.includes("instapay")) {
    return "Instapay";
  }
  if (lower === "cod" || lower === "cash on delivery") return "COD";
  const match = PAYMENT_METHOD_OPTIONS.find((o) => o.value.toLowerCase() === lower);
  if (match) return match.value;
  return "COD";
}

function normalizeOrderType(value) {
  const s = String(value ?? "new").trim().toLowerCase();
  if (s === "replacement" || s === "return" || s === "new") return s;
  return "new";
}

function normalizeOrderSource(value) {
  const s = String(value ?? "store").trim().toLowerCase();
  const allowed = ORDER_SOURCE_OPTIONS.map((o) => o.value);
  return allowed.includes(s) ? s : "store";
}

function normalizeShippingStatus(value) {
  const s = String(value ?? "in_progress").trim().toLowerCase();
  if (s === "delivered" || s === "failed" || s === "in_progress") return s;
  return "in_progress";
}

function lineSubtotal(row) {
  const q = Number(row.quantity) || 0;
  const p = Number(row.price) || 0;
  return q * p;
}

export default function OrderPayloadDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo ?? "/orders";
  const order = location.state?.order ?? null;

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [form, setForm] = useState({
    orderAlias: "",
    firstLine: "",
    cityName: "",
    cityId: "",
    districtId: "",
    note: "",
    allowToOpenPackage: false,
    firstName: "",
    mobile: "",
    type: "FORWARD",
    shipping_cost: "",
    payment_method: "COD",
    order_type: "new",
    order_source: "store",
    shipping_status: "in_progress",
  });
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [localStatusHistory, setLocalStatusHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadZones() {
      try {
        setZonesLoading(true);
        const result = await getZones();
        const list = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.zones)
            ? result.zones
            : Array.isArray(result)
              ? result
              : [];
        if (!cancelled) {
          setZones(list);
        }
      } catch (e) {
        console.log(e);
        if (!cancelled) {
          setZones([]);
        }
      } finally {
        if (!cancelled) {
          setZonesLoading(false);
        }
      }
    }

    loadZones();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        const data = await getProducts({ page: 1, limit: 100 });
        const list = normalizeProductListFromApi(data);
        if (!cancelled) setCatalogProducts(list);
      } catch (e) {
        console.log(e);
        if (!cancelled) setCatalogProducts([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!order) return;

    const sourceItems = Array.isArray(order.lineItems)
      ? order.lineItems
      : Array.isArray(order.cart_items)
        ? order.cart_items
        : [];

    setCartItems(sourceItems.map((item, idx) => cartRowFromOrderItem(item, idx)));

    setForm((prev) => ({
      ...prev,
      orderAlias: order.alias ?? order.shortId ?? "sec_order",
      firstLine:
        orderAddress(order) !== "—"
          ? orderAddress(order)
          : "102 street mohamed abd el shafy, alexandria",
      cityName: order.city ?? "",
      note: order.note ?? "deliver note",
      firstName: orderCustomer(order) !== "—" ? orderCustomer(order) : "ahmed",
      mobile: orderPhone(order) !== "—" ? orderPhone(order) : "01028687408",
      shipping_cost: String(
        order.shipping_cost ??
          order.shippingCost ??
          order.totals?.shipping ??
          order.totals?.shippingCost ??
          "",
      ),
      payment_method: normalizePaymentMethod(
        order.payment_method ??
          order["Payment Method"] ??
          order.totals?.paymentMethod ??
          (orderPayment(order) !== "—" ? orderPayment(order) : "COD"),
      ),
      order_type: normalizeOrderType(order.order_type ?? order.orderType),
      order_source: normalizeOrderSource(order.order_source ?? order.orderSource),
      shipping_status: normalizeShippingStatus(
        order.shipping_status ?? order.shippingStatus,
      ),
    }));
  }, [order]);

  const itemsSubtotal = useMemo(
    () => cartItems.reduce((sum, row) => sum + lineSubtotal(row), 0),
    [cartItems],
  );

  const shippingNum = useMemo(
    () => parseNonNegativeMoney(form.shipping_cost),
    [form.shipping_cost],
  );

  const grandTotalSuggested = useMemo(
    () => itemsSubtotal + shippingNum,
    [itemsSubtotal, shippingNum],
  );

  const collectionTotalDisplay = useMemo(
    () => formatMoney(grandTotalSuggested),
    [grandTotalSuggested],
  );

  const districts = useMemo(() => {
    const selectedCity = zones.find(
      (zone) =>
        String(zone?._id ?? zone?.id ?? "") === String(form.cityId) ||
        String(zone?.zoneId ?? "") === String(form.cityId)
    );
    const list = selectedCity?.districts ?? selectedCity?.areas ?? [];
    return Array.isArray(list) ? list : [];
  }, [zones, form.cityId]);

  useEffect(() => {
    const selectedCity = zones.find(
      (zone) =>
        String(zone?._id ?? zone?.id ?? "") === String(form.cityId) ||
        String(zone?.zoneId ?? "") === String(form.cityId)
    );
    if (!selectedCity) return;

    setForm((prev) => ({
      ...prev,
      cityName: selectedCity.name ?? selectedCity.zoneName ?? prev.cityName,
    }));
  }, [form.cityId, zones]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateCartRow(rowKey, patch) {
    setCartItems((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  }

  function removeCartRow(rowKey) {
    setCartItems((prev) => prev.filter((row) => row.key !== rowKey));
  }

  function addCartRowAtEnd() {
    setCartItems((prev) => [...prev, createEmptyCartRow()]);
  }

  function addCartRowBelow(rowKey) {
    const newRow = createEmptyCartRow();
    setCartItems((prev) => {
      const i = prev.findIndex((r) => r.key === rowKey);
      if (i === -1) return [...prev, newRow];
      return [...prev.slice(0, i + 1), newRow, ...prev.slice(i + 1)];
    });
  }

  function handleRowCatalogSelect(rowKey, optionId) {
    if (!optionId) {
      updateCartRow(rowKey, {
        sku: "",
        name: "",
        price: 0,
        catalogProductId: null,
        catalogProductKey: "",
        catalogOptionId: "",
      });
      return;
    }
    const idx = catalogProducts.findIndex(
      (p, i) => productOptionId(p, i) === optionId,
    );
    if (idx === -1) return;
    const fields = productToCartFields(catalogProducts[idx]);
    updateCartRow(rowKey, { ...fields, catalogOptionId: optionId });
  }

  function handleBack() {
    navigate(returnTo);
  }

  const orderIdForStatusUpdate =
    order?.id ?? order?.["Order ID"] ?? order?.orderId ?? order?.order_id ?? null;

  const statusButtons = [
    { key: "cancelled", label: "لاغي", bg: "#e74c3c" },
    { key: "no_answer", label: "لا يرد", bg: "#f39c12" },
    { key: "follow_up", label: "متابعة", bg: "#3498db" },
    { key: "duplicate", label: "مكرر", bg: "#9b59b6" },
    { key: "shipped", label: "تم الشحن", bg: "#27ae60" },
  ];

  const backendStatusMap = {
    لاغي: "canceled",
    "لا يرد": "no_replay",
    متابعة: "follow up",
    مكرر: "repeater",
    "تم الشحن": "Shipped",
    "تم التأكيد": "Confirmed",
  };

  const backendStatusCandidatesMap = {
    لاغي: ["canceled", "Canceled", "cancelled", "Cancelled"],
    "لا يرد": ["no_replay", "no reply", "no_reply", "NoReplay", "No Reply"],
    متابعة: ["follow up", "follow_up", "Follow Up", "FollowUp"],
    مكرر: ["repeater", "Repeater", "duplicate", "Duplicate"],
    "تم الشحن": ["Shipped", "shipped"],
    "تم التأكيد": ["Confirmed", "confirmed"],
  };

  const backendToUiStatusMap = {
    canceled: "لاغي",
    cancelled: "لاغي",
    new: "جديد",
    no_replay: "لا يرد",
    "follow up": "متابعة",
    repeater: "مكرر",
    confirmed: "تم التأكيد",
    shipped: "تم الشحن",
  };

  function mapBackendStatusToUi(statusValue) {
    const normalized = String(statusValue ?? "").trim().toLowerCase();
    return backendToUiStatusMap[normalized] ?? String(statusValue ?? "جديد");
  }

  function formatHistoryTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function normalizeHistoryItem(item) {
    if (!item || typeof item !== "object") return null;
    const rawStatus =
      item.status ?? item.toStatus ?? item.newStatus ?? item.orderStatus ?? item.label;
    const status = rawStatus ? mapBackendStatusToUi(rawStatus) : "—";
    const user = resolveActorDisplayName(item) ?? "—";
    const timestamp =
      item.timestamp ??
      item.updatedAt ??
      item.updated_at ??
      item.createdAt ??
      item.created_at ??
      null;
    return { status, user, timestamp };
  }

  function resolveStatusFromAllowed(statusLabel, allowedStatuses = []) {
    const normalizedAllowed = allowedStatuses.map((v) => String(v).trim());
    if (normalizedAllowed.length === 0) return null;

    const candidates = backendStatusCandidatesMap[statusLabel] ?? [];
    const directMatch = candidates.find((candidate) =>
      normalizedAllowed.includes(candidate)
    );
    if (directMatch) return directMatch;

    const normalize = (v) =>
      String(v)
        .toLowerCase()
        .replace(/[\s_-]/g, "");

    const normalizedCandidates = candidates.map(normalize);
    const fuzzyMatch = normalizedAllowed.find((allowed) =>
      normalizedCandidates.includes(normalize(allowed))
    );
    return fuzzyMatch ?? null;
  }

  async function applyStatus(statusLabel) {
    const backendStatus = backendStatusMap[statusLabel];
    if (!backendStatus) {
      alert("الحالة غير مدعومة");
      return;
    }
    if (!orderIdForStatusUpdate) {
      alert("لا يوجد رقم طلب صالح لتحديث الحالة");
      return;
    }

    try {
      setStatusUpdating(true);
      await updateOrderStatus(orderIdForStatusUpdate, backendStatus);
      setSelectedStatus(statusLabel);
      setLocalStatusHistory((prev) => [
        {
          status: statusLabel,
          user: getActiveUserDisplayName(),
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
      return true;
    } catch (error) {
      console.log(error);
      const allowedStatuses = error?.response?.data?.allowedStatuses;
      const retryStatus = resolveStatusFromAllowed(statusLabel, allowedStatuses);

      if (retryStatus && retryStatus !== backendStatus) {
        try {
          await updateOrderStatus(orderIdForStatusUpdate, retryStatus);
          setSelectedStatus(statusLabel);
          setLocalStatusHistory((prev) => [
            {
              status: statusLabel,
              user: getActiveUserDisplayName(),
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ]);
          return true;
        } catch (retryError) {
          console.log(retryError);
        }
      }

      if (Array.isArray(allowedStatuses) && allowedStatuses.length > 0) {
        alert(
          `قيمة الحالة غير صحيحة. القيم المسموحة: ${allowedStatuses.join(" , ")}`
        );
      } else {
        alert("حصل خطأ أثناء تحديث حالة الطلب");
      }
      return false;
    } finally {
      setStatusUpdating(false);
    }
  }

  function handleStatusClick(statusLabel) {
    if (statusLabel === "تم الشحن") {
      handleShipAndOpenModal();
      return;
    }
    applyStatus(statusLabel);
  }

  async function handleShipAndOpenModal() {
    const isUpdated = await applyStatus("تم الشحن");
    if (isUpdated) {
      setIsConfirmModalOpen(true);
    }
  }

  function handleConfirmOnly() {
    applyStatus("تم التأكيد");
  }

  function handleCloseConfirmModal() {
    setIsConfirmModalOpen(false);
  }

  async function handleSendToBosta() {
    setIsConfirmModalOpen(false);
    alert("تم إرسال الطلب إلى بوسطة");
  }

  async function handleSaveOrderChanges() {
    if (!orderIdForStatusUpdate) {
      alert("لا يوجد رقم طلب صالح لتعديل البيانات");
      return;
    }

    const linesForPayload = cartItems.filter(
      (row) =>
        String(row.name ?? "").trim() !== "" || String(row.sku ?? "").trim() !== "",
    );
    if (linesForPayload.length === 0) {
      alert("أضيفي صفاً واختاري منتجاً من القائمة");
      return;
    }

    const initialStatus =
      order?.orderStatus ??
      order?.order_status ??
      order?.status ??
      order?.["Order Status"] ??
      "جديد";
    const uiStatusForSave = selectedStatus || mapBackendStatusToUi(initialStatus) || "جديد";
    const backendStatus = backendStatusMap[uiStatusForSave] ?? "new";
    const showShipFields = uiStatusForSave === "تم الشحن";
    const cartPayload = linesForPayload.map((row) => {
      const line = {
        sku: row.sku,
        skuCode: row.sku,
        product_name: row.name,
        quantity: Number(row.quantity) || 1,
        price: Number(row.price) || 0,
      };
      if (row.catalogProductId != null) {
        line.product_id = row.catalogProductId;
      } else if (row.catalogProductKey) {
        line.product_id = row.catalogProductKey;
      } else if (row.catalogOptionId) {
        const pi = catalogProducts.findIndex(
          (p, i) => productOptionId(p, i) === row.catalogOptionId,
        );
        if (pi !== -1) {
          const p = unwrapCatalogProduct(catalogProducts[pi]);
          const rid =
            p?.id ?? p?._id ?? p?.easyorder_id ?? parseProductRawData(p).id;
          if (rid != null && rid !== "") line.product_id = rid;
        }
      }
      return line;
    });
    const payload = {
      full_name: form.firstName,
      phone: form.mobile,
      cityName: form.cityName,
      status: backendStatus,
      cart_items: cartPayload,
      shipping_cost: parseNonNegativeMoney(form.shipping_cost),
      payment_method: form.payment_method,
      order_source: form.order_source,
      order_type: form.order_type,
      ...(showShipFields ? { shipping_status: form.shipping_status } : {}),
    };

    try {
      setSavingOrder(true);
      await updateOrder(orderIdForStatusUpdate, payload);
      alert("تم حفظ تعديلات الطلب بنجاح");
    } catch (error) {
      console.log(error);
      const message = error?.response?.data?.message ?? "تعذر حفظ التعديلات";
      alert(message);
    } finally {
      setSavingOrder(false);
    }
  }

  const initialOrderStatus =
    order?.orderStatus ??
    order?.order_status ??
    order?.status ??
    order?.["Order Status"] ??
    "جديد";
  const currentOrderStatus = selectedStatus || mapBackendStatusToUi(initialOrderStatus);

  const backendStatusHistory = useMemo(() => {
    if (!order) return [];
    const source =
      (Array.isArray(order.statusHistory) && order.statusHistory) ||
      (Array.isArray(order.status_history) && order.status_history) ||
      (Array.isArray(order.timeline?.statusChanges) && order.timeline.statusChanges) ||
      (Array.isArray(order.timeline?.history) && order.timeline.history) ||
      (Array.isArray(order.history) && order.history) ||
      [];
    return source.map(normalizeHistoryItem).filter(Boolean);
  }, [order]);

  const statusHistory = useMemo(() => {
    if (!order) return [];
    const merged = [...localStatusHistory, ...backendStatusHistory];
    if (merged.length > 0) return merged;
    return [
      {
        status: currentOrderStatus,
        user: resolveActorDisplayName(order) ?? "غير معروف",
        timestamp: order.updated_at ?? order.created_at ?? order.date ?? null,
      },
    ];
  }, [backendStatusHistory, currentOrderStatus, localStatusHistory, order]);

  const lastUpdateBy = order
    ? (() => {
        const u = statusHistory[0]?.user;
        if (u && u !== "—") return u;
        return resolveActorDisplayName(order) ?? "غير معروف";
      })()
    : "غير معروف";

  if (!order) {
    return (
      <div className="order-details-page">
        <button
          type="button"
          onClick={handleBack}
          className="order-details-page__btn order-details-page__btn--outline"
        >
          رجوع
        </button>
        <p>لا توجد بيانات أوردر. افتحي الصفحة من قائمة الطلبات.</p>
      </div>
    );
  }

  const statusColorMap = {
    لاغي: "#e74c3c",
    "لا يرد": "#f39c12",
    متابعة: "#3498db",
    مكرر: "#9b59b6",
    "تم الشحن": "#27ae60",
    "تم التأكيد": "#16a085",
    جديد: "#7f8c8d",
  };
  const statusBadgeColor = statusColorMap[currentOrderStatus] ?? "#7f8c8d";

  return (
    <div className="order-details-page">
      <div className="order-details-page__topbar">
        <div className="order-details-page__title">
          <h1>تفاصيل الطلب #{orderDisplayId(order)}</h1>
          <span className="order-details-page__badge" style={{ background: statusBadgeColor }}>
            {orderStatusUiLabel(currentOrderStatus)}
          </span>
        </div>
        <span className="order-details-page__updated-by">آخر تحديث بواسطة: {lastUpdateBy}</span>
        <div className="order-details-page__topbar-actions">
          <div
            className="order-details-page__topbar-quick-fields"
            aria-label="حالة الطلب والنوع والمصدر"
          >
            <label className="order-details-page__topbar-mini-field">
              <span className="order-details-page__topbar-mini-label">حالة الطلب</span>
              <select
                className="order-details-page__input order-details-page__input--topbar-compact"
                value={selectedStatus || mapBackendStatusToUi(initialOrderStatus)}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {ORDER_STATUS_UI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="order-details-page__topbar-mini-field">
              <span className="order-details-page__topbar-mini-label">نوع الطلب</span>
              <select
                className="order-details-page__input order-details-page__input--topbar-compact"
                value={form.order_type}
                onChange={(e) => setField("order_type", e.target.value)}
              >
                {ORDER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="order-details-page__topbar-mini-field">
              <span className="order-details-page__topbar-mini-label">مصدر الطلب</span>
              <select
                className="order-details-page__input order-details-page__input--topbar-compact"
                value={form.order_source}
                onChange={(e) => setField("order_source", e.target.value)}
              >
                {ORDER_SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {currentOrderStatus === "تم الشحن" ? (
              <label className="order-details-page__topbar-mini-field">
                <span className="order-details-page__topbar-mini-label">حالة الشحن</span>
                <select
                  className="order-details-page__input order-details-page__input--topbar-compact"
                  value={form.shipping_status}
                  onChange={(e) => setField("shipping_status", e.target.value)}
                >
                  {SHIPPING_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSaveOrderChanges}
            disabled={savingOrder}
            className="order-details-page__btn order-details-page__btn--primary"
          >
            {savingOrder ? "جاري الحفظ..." : "حفظ تعديلات الطلب"}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="order-details-page__btn order-details-page__btn--outline"
          >
            رجوع
          </button>
        </div>
      </div>

      <div className="order-details-page__layout">
        <div>
          <section className="order-details-page__card">
            <h3>عناصر السلة</h3>

            {cartItems.length === 0 ? (
              <p className="order-details-page__cart-empty">
                لا توجد عناصر. اضغطي «إضافة صف» ثم اختاري المنتج من القائمة في كل سطر.
              </p>
            ) : (
              <div className="order-details-page__cart-table-wrap">
                <table className="order-details-page__cart-table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>الإجمالي</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <select
                            className="order-details-page__input order-details-page__input--table order-details-page__cart-product-select"
                            value={cartRowSelectValue(row, catalogProducts)}
                            onChange={(e) =>
                              handleRowCatalogSelect(row.key, e.target.value)
                            }
                            disabled={catalogLoading || catalogProducts.length === 0}
                          >
                            <option value="">
                              {catalogProducts.length === 0
                                ? "لا توجد منتجات"
                                : "— اختر منتجاً —"}
                            </option>
                            {catalogProducts.map((p, idx) => {
                              const oid = productOptionId(p, idx);
                              const u = unwrapCatalogProduct(p);
                              const rd = parseProductRawData(u);
                              const title = catalogProductDisplayName(p, idx);
                              const sku = String(u?.sku ?? rd.sku ?? "");
                              const priceNum = Number(u?.price ?? rd.price ?? 0) || 0;
                              const label = sku
                                ? `${title} (${sku}) — ${formatMoney(priceNum)} ج`
                                : `${title} — ${formatMoney(priceNum)} ج`;
                              return (
                                <option key={oid} value={oid}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td>
                          <input
                            className="order-details-page__input order-details-page__input--table"
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              updateCartRow(row.key, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="order-details-page__input order-details-page__input--table"
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.price}
                            onChange={(e) =>
                              updateCartRow(row.key, {
                                price: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td>{formatMoney(lineSubtotal(row))} ج</td>
                        <td>
                          <div className="order-details-page__cart-row-actions">
                            <button
                              type="button"
                              className="order-details-page__btn order-details-page__btn--small order-details-page__btn--cart-delete"
                              onClick={() => removeCartRow(row.key)}
                            >
                              حذف
                            </button>
                            <button
                              type="button"
                              className="order-details-page__btn order-details-page__btn--small order-details-page__btn--cart-add"
                              onClick={() => addCartRowBelow(row.key)}
                              disabled={catalogLoading}
                            >
                              إضافة
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
           <div className="order-details-page__fields-row order-details-page__fields-row--tri">
             
             <label className="order-details-page__field">
               تكلفة الشحن 
               <input
                 className="order-details-page__input"
                 type="number"
                 min={0}
                 step="0.01"
                 value={form.shipping_cost}
                 onChange={(e) => setField("shipping_cost", e.target.value)}
               />
             </label>
             <label className="order-details-page__field">
               مبلغ التحصيل
               <div
                 className="order-details-page__input order-details-page__input--computed"
                 role="status"
                 aria-live="polite"
                 aria-atomic="true"
                 title="يُحسب تلقائياً من مجموع المنتجات وتكلفة الشحن"
               >
                 {collectionTotalDisplay}
               </div>
             </label>
             <label className="order-details-page__field">
               طريقة الدفع 
               <select
                 className="order-details-page__input"
                 value={form.payment_method}
                 onChange={(e) => setField("payment_method", e.target.value)}
               >
                 {PAYMENT_METHOD_OPTIONS.map((o) => (
                   <option key={o.value} value={o.value}>
                     {o.label}
                   </option>
                 ))}
               </select>
             </label>
           </div>
          </section>

          <section className="order-details-page__card">
            <h3>بيانات الطلب</h3>
            <div className="order-details-page__fields">
             
              <div className="order-details-page__fields-row order-details-page__fields-row--duo">
                <label className="order-details-page__field">
                  اسم العميل
                  <input
                    className="order-details-page__input"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                  />
                </label>
                <label className="order-details-page__field">
                  رقم الموبايل
                  <input
                    className="order-details-page__input"
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                  />
                </label>
              </div>
              <div className="order-details-page__fields-row order-details-page__fields-row--tri">
                <label className="order-details-page__field">
                  المدينة
                  <select
                    className="order-details-page__input"
                    value={form.cityId}
                    onChange={(e) => {
                      setField("cityId", e.target.value);
                      setField("districtId", "");
                    }}
                    disabled={zonesLoading}
                  >
                    <option value="">اختر المدينة</option>
                    {zones.map((zone) => {
                      const id = zone?._id ?? zone?.id ?? zone?.zoneId;
                      return (
                        <option key={id} value={id}>
                          {zone?.name ?? zone?.zoneName ?? "—"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="order-details-page__field">
                  المنطقة
                  <select
                    className="order-details-page__input"
                    value={form.districtId}
                    onChange={(e) => setField("districtId", e.target.value)}
                    disabled={!form.cityId}
                  >
                    <option value="">اختر المنطقة</option>
                    {districts.map((district) => {
                      const id = district?._id ?? district?.id ?? district?.districtId;
                      return (
                        <option key={id} value={id}>
                          {district?.name ?? district?.districtName ?? "—"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="order-details-page__field order-details-page__field--checkbox-row">
                  <span>السماح بفتح الشحنة</span>
                  <input
                    type="checkbox"
                    className="order-details-page__checkbox-input"
                    checked={Boolean(form.allowToOpenPackage)}
                    onChange={(e) => setField("allowToOpenPackage", e.target.checked)}
                  />
                </label>
              </div>
              <label className="order-details-page__field order-details-page__field--full">
                العنوان
                <input
                  className="order-details-page__input"
                  value={form.firstLine}
                  onChange={(e) => setField("firstLine", e.target.value)}
                />
              </label>
            </div>
            
          </section>

          <section className="order-details-page__card">
  
            {selectedStatus && (
              <p className="order-details-page__status-note">
                الحالة الحالية: <strong>{orderStatusUiLabel(selectedStatus)}</strong>
              </p>
            )}
          </section>

          <section className="order-details-page__card">
            <h3>سجل التعديلات</h3>
            <ul className="order-details-page__history-list">
              {statusHistory.map((entry, index) => (
                <li key={`${entry.status}-${entry.timestamp}-${index}`} className="order-details-page__history-item">
                  <strong>{orderStatusUiLabel(entry.status)}</strong>
                  <span>{entry.user}</span>
                  <time>{formatHistoryTime(entry.timestamp)}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-details-page__card order-details-page__card--summary">
          <h3>ملخص الطلب</h3>
          <div className="order-details-page__summary-list">
            <div className="order-details-page__summary-row">
              <span>العميل</span>
              <strong>{form.firstName || "—"}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>الهاتف</span>
              <strong>{form.mobile || "—"}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>حالة الطلب</span>
              <strong>{orderStatusUiLabel(currentOrderStatus)}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>نوع الطلب</span>
              <strong>{orderTypeUiLabel(form.order_type)}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>عدد بنود السلة</span>
              <strong>{cartItems.length}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>مجموع المنتجات</span>
              <strong>{formatMoney(itemsSubtotal)} ج</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>تكلفة الشحن</span>
              <strong>{formatMoney(shippingNum)} ج</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>طريقة الدفع</span>
              <strong>{form.payment_method || "—"}</strong>
            </div>
           
            <div className="order-details-page__summary-row">
              <span>مبلغ التحصيل</span>
              <strong>{collectionTotalDisplay} ج</strong>
            </div>
          </div>
        </aside>
      </div>
      {isConfirmModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "min(480px, 92vw)",
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>إرسال الطلب</h3>
            <p>هل تريدين إرسال الطلب إلى بوسطة؟</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleSendToBosta}
                disabled={statusUpdating}
                style={{
                  background: "#16a085",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  opacity: statusUpdating ? 0.7 : 1,
                }}
              >
                {statusUpdating ? "جاري الإرسال..." : "إرسال إلى بوسطة"}
              </button>
              <button
                type="button"
                onClick={handleCloseConfirmModal}
                style={{
                  background: "#ecf0f1",
                  color: "#2c3e50",
                  border: "1px solid #d0d7de",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
