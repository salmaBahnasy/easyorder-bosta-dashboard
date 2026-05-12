import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrder, getProducts, getZones } from "../../api/ordersApi";
import {
  cartRowSelectValue,
  catalogProductDisplayName,
  createEmptyCartRow,
  parseProductRawData,
  productOptionId,
  productToCartFields,
  unwrapCatalogProduct,
} from "./cartCatalogHelpers";
import { normalizeProductListFromApi } from "../../utils/normalizeProductListFromApi";
import "./OrderPayloadDetailsPage.css";
import "./CreateOrderPage.css";

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return String(Math.round(n * 100) / 100);
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

const backendStatusMap = {
  لاغي: "canceled",
  "لا يرد": "no_replay",
  متابعة: "follow up",
  مكرر: "repeater",
  "تم الشحن": "Shipped",
  "تم التأكيد": "Confirmed",
  جديد: "new",
};

function lineSubtotal(row) {
  const q = Number(row.quantity) || 0;
  const p = Number(row.price) || 0;
  return q * p;
}

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [cartItems, setCartItems] = useState(() => [createEmptyCartRow()]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState("جديد");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    orderAlias: "",
    firstLine: "",
    cityName: "",
    cityId: "",
    districtId: "",
    codAmount: "",
    note: "",
    allowToOpenPackage: false,
    firstName: "",
    mobile: "",
    shipping_cost: "",
    payment_method: "COD",
    order_type: "new",
    order_source: "store",
    shipping_status: "in_progress",
  });

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

  const districts = useMemo(() => {
    const selectedCity = zones.find(
      (zone) =>
        String(zone?._id ?? zone?.id ?? "") === String(form.cityId) ||
        String(zone?.zoneId ?? "") === String(form.cityId),
    );
    const list = selectedCity?.districts ?? selectedCity?.areas ?? [];
    return Array.isArray(list) ? list : [];
  }, [zones, form.cityId]);

  useEffect(() => {
    const selectedCity = zones.find(
      (zone) =>
        String(zone?._id ?? zone?.id ?? "") === String(form.cityId) ||
        String(zone?.zoneId ?? "") === String(form.cityId),
    );
    if (!selectedCity) return;

    setForm((prev) => ({
      ...prev,
      cityName: selectedCity.name ?? selectedCity.zoneName ?? prev.cityName,
    }));
  }, [form.cityId, zones]);

  const itemsSubtotal = useMemo(
    () => cartItems.reduce((sum, row) => sum + lineSubtotal(row), 0),
    [cartItems],
  );

  useEffect(() => {
    const shipping = Number(form.shipping_cost) || 0;
    const suggested = itemsSubtotal + shipping;
    setForm((prev) => ({
      ...prev,
      codAmount: formatMoney(suggested),
    }));
  }, [itemsSubtotal, form.shipping_cost]);

  const shippingNum = Number(form.shipping_cost) || 0;
  const grandTotalSuggested = itemsSubtotal + shippingNum;
  const summaryCod = form.codAmount || String(grandTotalSuggested || "0");
  const currentOrderStatus = selectedOrderStatus || "جديد";

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateCartRow(rowKey, patch) {
    setCartItems((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  }

  function removeCartRow(rowKey) {
    setCartItems((prev) => {
      const next = prev.filter((row) => row.key !== rowKey);
      if (next.length === 0) return [createEmptyCartRow()];
      return next;
    });
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
    navigate("/orders");
  }

  async function handleCreateOrder() {
    if (!form.mobile?.trim()) {
      alert("رقم الموبايل مطلوب");
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

    const uiStatus = selectedOrderStatus || "جديد";
    const backendStatus = backendStatusMap[uiStatus] ?? "new";

    const cartPayload = linesForPayload.map((row) => {
      const item = {
        quantity: Number(row.quantity) || 1,
        product: {
          name: row.name || "منتج",
          sku: row.sku || "SKU-001",
        },
      };
      if (row.catalogProductId != null) {
        item.product_id = row.catalogProductId;
      } else if (row.catalogProductKey) {
        item.product_id = row.catalogProductKey;
      } else if (row.catalogOptionId) {
        const pi = catalogProducts.findIndex(
          (p, i) => productOptionId(p, i) === row.catalogOptionId,
        );
        if (pi !== -1) {
          const p = unwrapCatalogProduct(catalogProducts[pi]);
          const rid =
            p?.id ?? p?._id ?? p?.easyorder_id ?? parseProductRawData(p).id;
          if (rid != null && rid !== "") item.product_id = rid;
        }
      }
      return item;
    });

    const nowIso = new Date().toISOString();

    const payload = {
      id: form.orderAlias?.trim() || `manual-order-${Date.now()}`,
      full_name: form.firstName?.trim() || "Customer",
      phone: form.mobile?.trim() || "",
      address: form.firstLine?.trim() || "",
      city: form.cityName?.trim() || "",
      status: backendStatus,
      order_source: form.order_source,
      order_type: form.order_type,
      ...(uiStatus === "تم الشحن" ? { shipping_status: form.shipping_status } : {}),
      shipping_cost: Number(form.shipping_cost) || 0,
      payment_method: form.payment_method,
      total: Number(form.codAmount) || grandTotalSuggested || 0,
      cart_items: cartPayload,
      note: form.note?.trim() || undefined,
      created_at: nowIso,
      date: nowIso,
    };

    try {
      setCreating(true);
      await createOrder(payload);
      alert("تم إنشاء الطلب بنجاح");
      navigate("/orders");
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ?? "تعذر إنشاء الطلب، تأكدي من الـ API";
      alert(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="order-details-page create-order-page--shell">
      <div className="order-details-page__topbar">
        <div className="order-details-page__title">
          <h1>إنشاء طلب جديد</h1>
        </div>
        <span className="order-details-page__updated-by">
          أدخلي البيانات ثم اضغطي «إنشاء الطلب»
        </span>
        <div className="order-details-page__topbar-actions">
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={creating}
            className="order-details-page__btn order-details-page__btn--primary"
          >
            {creating ? "جاري الإنشاء..." : "إنشاء الطلب"}
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
                
                  <input
                    className="order-details-page__input"
                    value={form.codAmount}
                    onChange={(e) => setField("codAmount", e.target.value)}
                  />
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
                العنوان (السطر الأول)
                <input
                  className="order-details-page__input"
                  value={form.firstLine}
                  onChange={(e) => setField("firstLine", e.target.value)}
                />
              </label>
              <div className="order-details-page__fields-row order-details-page__fields-row--tri">
                <label className="order-details-page__field">
                  حالة الطلب
                  <select
                    className="order-details-page__input"
                    value={selectedOrderStatus || "جديد"}
                    onChange={(e) => setSelectedOrderStatus(e.target.value)}
                  >
                    {ORDER_STATUS_UI_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="order-details-page__field">
                  نوع الطلب
                  <select
                    className="order-details-page__input"
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
                <label className="order-details-page__field">
                  مصدر الطلب
                  <select
                    className="order-details-page__input"
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
              </div>
              {currentOrderStatus === "تم الشحن" ? (
                <label className="order-details-page__field order-details-page__field--full">
                  حالة الشحن
                  <select
                    className="order-details-page__input"
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
              <label className="order-details-page__field order-details-page__field--full">
                ملاحظات
                <textarea
                  className="order-details-page__input create-order-page__note"
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  rows={3}
                />
              </label>
            </div>
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
              <strong>{orderStatusUiLabel(selectedOrderStatus || "جديد")}</strong>
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
              <span>مبلغ التحصيل (COD)</span>
              <strong>{summaryCod} ج</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
