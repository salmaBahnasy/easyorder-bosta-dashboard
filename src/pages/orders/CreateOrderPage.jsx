import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createOrder } from "../../api/ordersApi";
import BostaCityDistrictFields from "../../components/BostaCityDistrictFields";
import CartProductSelect from "../../components/CartProductSelect";
import CartProductVariantSelect from "../../components/CartProductVariantSelect";
import CartProductBostaSkuSelect from "../../components/CartProductBostaSkuSelect";
import FeedbackModal from "../../components/FeedbackModal";
import { useProductCatalog } from "../../hooks/useProductCatalog";
import { appHref } from "../../utils/auth";
import {
  createEmptyCartRow,
  parseProductRawData,
  productOptionId,
  productToCartFields,
  unwrapCatalogProduct,
} from "./cartCatalogHelpers";
import {
  bostaCityLabel,
  parseDistrictHintFromAddress,
} from "../../utils/bostaLocation";
import { buildCreateOrderDraftFromOrder } from "../../utils/orderCustomerDraft";
import {
  buildEasyOrderCartItems,
  buildEasyOrderCreatePayload,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodOptionLabel,
} from "../../utils/easyOrderOrderPayload";
import { validateCreateOrderForm } from "../../utils/createOrderValidation";
import {
  applyVariantSelection,
  clearCartRowVariantFields,
  loadVariantsForCatalogProduct,
} from "../../utils/cartProductVariants";
import {
  applyBostaSkuSelection,
  clearCartRowBostaSkuFields,
  loadBostaSkusForCatalogProduct,
} from "../../utils/cartBostaSkus";
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
  { value: "old_customer", label: "عميل قديم" },
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
  const location = useLocation();
  const copyAppliedRef = useRef(false);
  const ordersListStateRef = useRef(null);
  const [copiedCustomerBanner, setCopiedCustomerBanner] = useState(false);
  const [cartItems, setCartItems] = useState(() => [createEmptyCartRow()]);
  const { catalogProducts, catalogLoading, onCatalogSearchChange } =
    useProductCatalog(cartItems);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState("جديد");
  const [creating, setCreating] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    variant: "success",
    message: "",
    navigateAfterClose: false,
  });

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
    mobile2: "",
    shipping_cost: "",
    payment_method: "cod",
    order_type: "new",
    order_source: "store",
    shipping_status: "in_progress",
  });

  useEffect(() => {
    if (location.state?.ordersListState) {
      ordersListStateRef.current = location.state.ordersListState;
    }

    const sourceOrder = location.state?.copyFromOrder;
    if (!sourceOrder || copyAppliedRef.current) return;

    const draft = buildCreateOrderDraftFromOrder(sourceOrder);
    if (!draft) return;

    copyAppliedRef.current = true;
    setForm((prev) => ({
      ...prev,
      firstName: draft.firstName || prev.firstName,
      mobile: draft.mobile || prev.mobile,
      mobile2: draft.mobile2 || prev.mobile2,
      firstLine: draft.firstLine || prev.firstLine,
      cityName: draft.cityName || prev.cityName,
      cityId: draft.cityId || prev.cityId,
      districtId: draft.districtId || prev.districtId,
      order_source: draft.order_source || prev.order_source,
    }));
    setCopiedCustomerBanner(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const itemsSubtotal = useMemo(
    () => cartItems.reduce((sum, row) => sum + lineSubtotal(row), 0),
    [cartItems],
  );

  const totalPieces = useMemo(
    () => cartItems.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
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

  async function handleRowCatalogSelect(rowKey, optionId) {
    if (!optionId) {
      updateCartRow(rowKey, {
        sku: "",
        name: "",
        price: "",
        catalogProductId: null,
        catalogProductKey: "",
        catalogOptionId: "",
        ...clearCartRowVariantFields(),
        ...clearCartRowBostaSkuFields(),
      });
      return;
    }
    const idx = catalogProducts.findIndex(
      (p, i) => productOptionId(p, i) === optionId,
    );
    if (idx === -1) return;
    const fields = productToCartFields(catalogProducts[idx]);
    updateCartRow(rowKey, {
      ...fields,
      price: "",
      catalogOptionId: optionId,
      ...clearCartRowVariantFields(),
      ...clearCartRowBostaSkuFields(),
      variantsLoading: true,
      bostaSkusLoading: true,
    });

    try {
      const product = catalogProducts[idx];
      const [variantResult, bostaResult] = await Promise.all([
        loadVariantsForCatalogProduct(product),
        loadBostaSkusForCatalogProduct(product),
      ]);
      const patch = {
        variantOptions: variantResult.variantOptions,
        variationLabel: variantResult.variationLabel,
        variantsLoading: false,
        bostaSkuOptions: bostaResult.bostaSkuOptions,
        bostaProductLabel: bostaResult.bostaProductLabel,
        bostaRecommendedSku: bostaResult.bostaRecommendedSku,
        bostaSkusLoading: false,
      };
      if (variantResult.variantOptions.length === 1) {
        Object.assign(
          patch,
          applyVariantSelection(variantResult.variantOptions, variantResult.variantOptions[0].id),
        );
      }
      if (bostaResult.bostaSkuOptions.length === 1) {
        Object.assign(
          patch,
          applyBostaSkuSelection(bostaResult.bostaSkuOptions, bostaResult.bostaSkuOptions[0].skuCode),
        );
      } else if (bostaResult.bostaRecommendedSku) {
        Object.assign(
          patch,
          applyBostaSkuSelection(bostaResult.bostaSkuOptions, bostaResult.bostaRecommendedSku),
        );
      }
      updateCartRow(rowKey, patch);
    } catch (error) {
      console.log(error);
      updateCartRow(rowKey, { variantsLoading: false, bostaSkusLoading: false });
    }
  }

  function handleRowBostaSkuSelect(rowKey, skuCode) {
    const row = cartItems.find((r) => r.key === rowKey);
    if (!row) return;
    if (!skuCode) {
      updateCartRow(rowKey, {
        selectedBostaSkuCode: "",
        selectedBostaSkuData: null,
      });
      return;
    }
    updateCartRow(rowKey, applyBostaSkuSelection(row.bostaSkuOptions, skuCode));
  }

  function handleRowVariantSelect(rowKey, variantId) {
    const row = cartItems.find((r) => r.key === rowKey);
    if (!row) return;
    if (!variantId) {
      updateCartRow(rowKey, {
        selectedVariantId: "",
        productVariantId: "",
        variationProp: "",
        variationProps: null,
        selectedVariantData: null,
      });
      return;
    }
    updateCartRow(rowKey, applyVariantSelection(row.variantOptions, variantId));
  }

  function handleBack() {
    navigate(appHref("orders"), {
      state: ordersListStateRef.current
        ? { ordersListState: ordersListStateRef.current }
        : undefined,
    });
  }

  function showFeedback(variant, message, { navigateAfterClose = false } = {}) {
    setFeedbackModal({
      open: true,
      variant,
      message,
      navigateAfterClose,
    });
  }

  function handleFeedbackClose() {
    const shouldNavigate = feedbackModal.navigateAfterClose;
    setFeedbackModal((prev) => ({
      ...prev,
      open: false,
      navigateAfterClose: false,
    }));
    if (shouldNavigate) {
      navigate(appHref("orders"));
    }
  }

  function handleMobileChange(value) {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
    setField("mobile", digits);
  }

  function handleMobile2Change(value) {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
    setField("mobile2", digits);
  }

  async function handleCreateOrder() {
    const validation = validateCreateOrderForm(form, cartItems);
    if (!validation.valid) {
      showFeedback("error", validation.errors.join("\n"));
      return;
    }

    const { linesForPayload, phoneDigits, phone2Digits } = validation;

    const uiStatus = selectedOrderStatus || "جديد";
    const backendStatus = backendStatusMap[uiStatus] ?? "new";
    const shippingStatusForApi =
      uiStatus === "تم الشحن" ? form.shipping_status : undefined;

    const linesWithProductIds = linesForPayload.map((row) => {
      if (row.catalogProductId != null || row.catalogProductKey) return row;
      if (!row.catalogOptionId) return row;
      const pi = catalogProducts.findIndex(
        (p, i) => productOptionId(p, i) === row.catalogOptionId,
      );
      if (pi === -1) return row;
      const p = unwrapCatalogProduct(catalogProducts[pi]);
      const rid = p?.id ?? p?._id ?? p?.easyorder_id ?? parseProductRawData(p).id;
      if (rid == null || rid === "") return row;
      return { ...row, resolvedProductId: rid };
    });

    const cartPayload = buildEasyOrderCartItems(linesWithProductIds);
    const nowIso = new Date().toISOString();
    const shippingCost = Number(form.shipping_cost) || 0;
    const totalCost = Number(form.codAmount) || grandTotalSuggested || 0;

    const payload = buildEasyOrderCreatePayload({
      id: form.orderAlias?.trim() || `manual-order-${Date.now()}`,
      fullName: form.firstName,
      phone: phoneDigits,
      phone2: phone2Digits,
      address: form.firstLine,
      government: form.cityName,
      cityId: form.cityId,
      districtId: form.districtId,
      orderSource: form.order_source,
      orderType: form.order_type,
      backendStatus,
      shippingStatus: shippingStatusForApi,
      paymentMethod: form.payment_method,
      shippingCost,
      itemsSubtotal,
      totalCost,
      cartItems: cartPayload,
      note: form.note,
      createdAt: nowIso,
    });

    try {
      setCreating(true);
      await createOrder(payload);
      showFeedback("success", "تم إنشاء الطلب بنجاح", { navigateAfterClose: true });
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ?? "تعذر إنشاء الطلب، تأكدي من الـ API";
      showFeedback("error", message);
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
          {copiedCustomerBanner
            ? "تم نسخ بيانات العميل — أكملي المنتجات ثم أنشئي الطلب"
            : "أدخلي البيانات ثم اضغطي «إنشاء الطلب»"}
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
                        <div className="order-details-page__cart-product-cell">
                          <CartProductSelect
                            row={row}
                            catalogProducts={catalogProducts}
                            catalogLoading={catalogLoading}
                            onSearchChange={onCatalogSearchChange}
                            onSelect={(optionId) =>
                              handleRowCatalogSelect(row.key, optionId)
                            }
                          />
                          <CartProductVariantSelect
                            row={row}
                            onSelect={(variantId) =>
                              handleRowVariantSelect(row.key, variantId)
                            }
                          />
                          <CartProductBostaSkuSelect
                            row={row}
                            onSelect={(skuCode) =>
                              handleRowBostaSkuSelect(row.key, skuCode)
                            }
                          />
                        </div>
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
                          value={row.price === "" || row.price == null ? "" : row.price}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateCartRow(row.key, {
                              price: raw === "" ? "" : Number(raw),
                            });
                          }}
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
                    required
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
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder="01xxxxxxxxx"
                    value={form.mobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                  />
                </label>
              </div>
              <div className="order-details-page__fields-row order-details-page__fields-row--duo">
                <label className="order-details-page__field">
                  رقم موبايل تاني (اختياري)
                  <input
                    className="order-details-page__input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder="01xxxxxxxxx"
                    value={form.mobile2}
                    onChange={(e) => handleMobile2Change(e.target.value)}
                  />
                </label>
              </div>
              <BostaCityDistrictFields
                cityId={form.cityId}
                districtId={form.districtId}
                cityNameHint={form.cityName}
                districtNameHint={parseDistrictHintFromAddress(
                  form.firstLine,
                  form.cityName,
                )}
                onCityChange={(cityId, cityOption) =>
                  setForm((prev) => ({
                    ...prev,
                    cityId,
                    districtId: "",
                    cityName: cityOption ? bostaCityLabel(cityOption) : "",
                  }))
                }
                onDistrictChange={(districtId) => setField("districtId", districtId)}
              />
              <label className="order-details-page__field order-details-page__field--full order-details-page__field--checkbox-row">
                <span>السماح بفتح الشحنة</span>
                <input
                  type="checkbox"
                  className="order-details-page__checkbox-input"
                  checked={Boolean(form.allowToOpenPackage)}
                  onChange={(e) => setField("allowToOpenPackage", e.target.checked)}
                />
              </label>
              <label className="order-details-page__field order-details-page__field--full">
                العنوان (السطر الأول)
                <input
                  className="order-details-page__input"
                  value={form.firstLine}
                  placeholder="الشارع، المبنى، علامة مميزة..."
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
                  placeholder="ملاحظات على الطلب (اختياري)"
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
            {form.mobile2 ? (
              <div className="order-details-page__summary-row">
                <span>هاتف إضافي</span>
                <strong>{form.mobile2}</strong>
              </div>
            ) : null}
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
              <span>عدد القطع</span>
              <strong>{totalPieces}</strong>
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
              <strong>{paymentMethodOptionLabel(form.payment_method)}</strong>
            </div>
            
            <div className="order-details-page__summary-row">
              <span>مبلغ التحصيل (COD)</span>
              <strong>{summaryCod} ج</strong>
            </div>
          </div>
        </aside>
      </div>

      <FeedbackModal
        open={feedbackModal.open}
        variant={feedbackModal.variant}
        message={feedbackModal.message}
        onClose={handleFeedbackClose}
      />
    </div>
  );
}
