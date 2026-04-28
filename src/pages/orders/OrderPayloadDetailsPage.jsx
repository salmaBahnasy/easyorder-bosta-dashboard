import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getZones, updateOrder, updateOrderStatus } from "../../api/ordersApi";
import {
  orderAddress,
  orderCustomer,
  orderDisplayId,
  orderPhone,
  orderTotalCost,
} from "../../utils/orderDisplay";
import "./OrderPayloadDetailsPage.css";

export default function OrderPayloadDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo ?? "/orders";
  const order = location.state?.order ?? null;

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [form, setForm] = useState({
    orderAlias: "",
    skuCode: "",
    quantity: 1,
    price: "",
    firstLine: "",
    cityName: "",
    cityId: "",
    districtId: "",
    codAmount: "",
    note: "",
    allowToOpenPackage: false,
    firstName: "",
    mobile: "",
    webhookUrl: "http://your-system.com/webhook",
    type: "FORWARD",
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
    if (!order) return;

    const sourceItems = Array.isArray(order.lineItems)
      ? order.lineItems
      : Array.isArray(order.cart_items)
        ? order.cart_items
        : [];
    const firstItem = sourceItems[0] ?? {};

    setForm((prev) => ({
      ...prev,
      orderAlias: order.alias ?? order.shortId ?? "sec_order",
      skuCode:
        firstItem.sku ??
        firstItem.skuCode ??
        firstItem.variant_name ??
        firstItem.product?.sku ??
        "product-1",
      quantity: Number(firstItem.quantity ?? firstItem.qty ?? 1) || 1,
      price: String(
        firstItem.price ?? firstItem.unitPrice ?? orderTotalCost(order) ?? "100"
      ),
      firstLine:
        orderAddress(order) !== "—"
          ? orderAddress(order)
          : "102 street mohamed abd el shafy, alexandria",
      cityName: order.city ?? "",
      codAmount: String(orderTotalCost(order) ?? "100"),
      note: order.note ?? "deliver note",
      firstName: orderCustomer(order) !== "—" ? orderCustomer(order) : "ahmed",
      mobile: orderPhone(order) !== "—" ? orderPhone(order) : "01028687408",
    }));
  }, [order]);

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
    const user =
      item.userName ??
      item.user_name ??
      item.updatedByName ??
      item.updated_by_name ??
      item.createdByName ??
      item.created_by_name ??
      item.user ??
      "—";
    const timestamp =
      item.timestamp ??
      item.updatedAt ??
      item.updated_at ??
      item.createdAt ??
      item.created_at ??
      null;
    return { status, user, timestamp };
  }

  function getActiveUserName() {
    try {
      const raw = localStorage.getItem("easyorder_user");
      if (!raw) return "المستخدم الحالي";
      const parsed = JSON.parse(raw);
      return parsed?.name ?? parsed?.full_name ?? parsed?.email ?? "المستخدم الحالي";
    } catch {
      return "المستخدم الحالي";
    }
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
          user: getActiveUserName(),
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

    const uiStatusForSave = selectedStatus || mapBackendStatusToUi(initialOrderStatus) || "جديد";
    const backendStatus = backendStatusMap[uiStatusForSave] ?? "new";
    const payload = {
      full_name: form.firstName,
      phone: form.mobile,
      cityName: form.cityName,
      status: backendStatus,
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

  const payloadPreview = {
    orderAlias: form.orderAlias,
    items: [
      {
        skuCode: form.skuCode,
        quantity: Number(form.quantity) || 1,
        price: Number(form.price) || 0,
      },
    ],
    shippingAddress: {
      firstLine: form.firstLine,
      cityName: form.cityName,
      cityId: form.cityId,
      districtId: form.districtId,
    },
    shipment: {
      codAmount: form.codAmount,
      note: form.note,
      allowToOpenPackage: form.allowToOpenPackage,
    },
    customer: {
      firstName: form.firstName,
      mobile: form.mobile,
    },
    externalPlatform: {
      platform: "custom_api",
      webhookUrl: form.webhookUrl,
    },
    type: form.type,
  };

  const initialOrderStatus =
    order?.orderStatus ??
    order?.order_status ??
    order?.status ??
    order?.["Order Status"] ??
    "جديد";
  const currentOrderStatus = selectedStatus || mapBackendStatusToUi(initialOrderStatus);
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
  const summaryTotal = form.codAmount || orderTotalCost(order) || form.price || "0";
  const backendStatusHistory = useMemo(() => {
    const source =
      (Array.isArray(order?.statusHistory) && order.statusHistory) ||
      (Array.isArray(order?.status_history) && order.status_history) ||
      (Array.isArray(order?.timeline?.statusChanges) && order.timeline.statusChanges) ||
      (Array.isArray(order?.timeline?.history) && order.timeline.history) ||
      (Array.isArray(order?.history) && order.history) ||
      [];
    return source.map(normalizeHistoryItem).filter(Boolean);
  }, [order]);

  const statusHistory = useMemo(() => {
    const merged = [...localStatusHistory, ...backendStatusHistory];
    if (merged.length > 0) return merged;
    return [
      {
        status: currentOrderStatus,
        user:
          order?.updatedByName ??
          order?.updated_by_name ??
          order?.createdByName ??
          order?.created_by_name ??
          "غير معروف",
        timestamp: order?.updated_at ?? order?.created_at ?? order?.date ?? null,
      },
    ];
  }, [backendStatusHistory, currentOrderStatus, localStatusHistory, order]);

  const lastUpdateBy = statusHistory[0]?.user ?? "غير معروف";

  return (
    <div className="order-details-page">
      <div className="order-details-page__topbar">
        <div className="order-details-page__title">
          <h1>تفاصيل الطلب #{orderDisplayId(order)}</h1>
          <span className="order-details-page__badge" style={{ background: statusBadgeColor }}>
            {currentOrderStatus}
          </span>
        </div>
        <span className="order-details-page__updated-by">آخر تحديث بواسطة: {lastUpdateBy}</span>
        <button
          type="button"
          onClick={handleBack}
          className="order-details-page__btn order-details-page__btn--outline"
        >
          رجوع
        </button>
      </div>

      <div className="order-details-page__layout">
        <div>
          <section className="order-details-page__card">
            <h3>بيانات الطلب</h3>
            <div className="order-details-page__fields">
              <label className="order-details-page__field">
                كود المنتج (SKU)
                <input
                  className="order-details-page__input"
                  value={form.skuCode}
                  onChange={(e) => setField("skuCode", e.target.value)}
                />
              </label>
              <label className="order-details-page__field">
                الكمية
                <input
                  className="order-details-page__input"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                />
              </label>
              <label className="order-details-page__field">
                السعر
                <input
                  className="order-details-page__input"
                  type="number"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </label>
              <label className="order-details-page__field">
                مبلغ التحصيل (COD)
                <input
                  className="order-details-page__input"
                  value={form.codAmount}
                  onChange={(e) => setField("codAmount", e.target.value)}
                />
              </label>
              <label className="order-details-page__field order-details-page__field--full">
                العنوان (السطر الأول)
                <input
                  className="order-details-page__input"
                  value={form.firstLine}
                  onChange={(e) => setField("firstLine", e.target.value)}
                />
              </label>
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
              <label className="order-details-page__field">
                السماح بفتح الشحنة
                <select
                  className="order-details-page__input"
                  value={String(form.allowToOpenPackage)}
                  onChange={(e) =>
                    setField("allowToOpenPackage", e.target.value === "true")
                  }
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </label>
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
              <label className="order-details-page__field order-details-page__field--full">
                ملاحظات
                <input
                  className="order-details-page__input"
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="order-details-page__card">
            <h3>تغيير الحالة</h3>
            <div className="order-details-page__status-actions">
              {statusButtons.map((status) => (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => handleStatusClick(status.label)}
                  disabled={statusUpdating}
                  className="order-details-page__pill"
                  style={{ background: status.bg, opacity: statusUpdating ? 0.7 : 1 }}
                >
                  {status.label}
                </button>
              ))}

              <button
                type="button"
                onClick={handleConfirmOnly}
                disabled={statusUpdating}
                className="order-details-page__pill"
                style={{ background: "#16a085", opacity: statusUpdating ? 0.7 : 1 }}
              >
                تم التأكيد
              </button>
            </div>

            {selectedStatus && (
              <p className="order-details-page__status-note">
                الحالة الحالية: <strong>{selectedStatus}</strong>
              </p>
            )}
          </section>

          <section className="order-details-page__card">
            <h3>سجل التعديلات</h3>
            <ul className="order-details-page__history-list">
              {statusHistory.map((entry, index) => (
                <li key={`${entry.status}-${entry.timestamp}-${index}`} className="order-details-page__history-item">
                  <strong>{entry.status}</strong>
                  <span>{entry.user}</span>
                  <time>{formatHistoryTime(entry.timestamp)}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-details-page__card">
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
              <span>SKU</span>
              <strong>{form.skuCode || "—"}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>الكمية</span>
              <strong>{form.quantity || 0}</strong>
            </div>
            <div className="order-details-page__summary-row">
              <span>الإجمالي</span>
              <strong>{summaryTotal} ج</strong>
            </div>
          </div>
        </aside>
      </div>

      <div className="order-details-page__footer">
        <button
          type="button"
          onClick={handleSaveOrderChanges}
          disabled={savingOrder}
          className="order-details-page__btn order-details-page__btn--primary"
        >
          {savingOrder ? "جاري الحفظ..." : "حفظ تعديلات الطلب"}
        </button>
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
