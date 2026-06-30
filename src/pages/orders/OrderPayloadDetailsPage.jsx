import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { updateOrder, updateOrderStatus, sendOrderToBosta } from "../../api/ordersApi";
import BostaCityDistrictFields from "../../components/BostaCityDistrictFields";
import CartProductSelect from "../../components/CartProductSelect";
import CartProductVariantSelect from "../../components/CartProductVariantSelect";
import CartProductBostaSkuSelect from "../../components/CartProductBostaSkuSelect";
import FeedbackModal from "../../components/FeedbackModal";
import { useProductCatalog } from "../../hooks/useProductCatalog";
import { appHref } from "../../utils/auth";
import {
  appendBostaLocationIdsToPayload,
  bostaCityLabel,
  getOrderGovernmentName,
  parseDistrictHintFromAddress,
  pickOrderBostaCityId,
  pickOrderBostaDistrictId,
  resolveBostaLocationForSend,
} from "../../utils/bostaLocation";
import {
  normalizeEasyOrderPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodOptionLabel,
  getPaymentMethodValidationError,
  resolveEasyOrderPaymentMethod,
} from "../../utils/easyOrderOrderPayload";
import {
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
  orderSecondPhone,
  formatOrderItemVariationProp,
} from "../../utils/orderDisplay";
import { formatApiErrorMessage } from "../../utils/apiErrors";
import { getActiveUserDisplayName, resolveActorDisplayName } from "../../utils/orderAudit";
import {
  applyVariantSelection,
  clearCartRowVariantFields,
  enrichCartRowWithVariants,
  loadVariantsForCatalogProduct,
  validateCartRowsVariants,
} from "../../utils/cartProductVariants";
import {
  applyBostaSkuSelection,
  clearCartRowBostaSkuFields,
  enrichCartRowWithBostaSkus,
  finalizeCartLine,
  loadBostaSkusForCatalogProduct,
  resolveBostaSkuForSend,
  validateCartRowsBostaSkus,
} from "../../utils/cartBostaSkus";
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
  const variationProp = formatOrderItemVariationProp(item) ?? "";
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
  const variant = item.variant ?? item.product?.variant;
  const variantIsObject = variant && typeof variant === "object" && !Array.isArray(variant);
  const productVariantId = String(
    item.product_variant_id ??
      item.productVariantId ??
      (variantIsObject ? variant.id : "") ??
      (typeof item.variant === "string" && item.variant.includes("-")
        ? item.variant
        : ""),
  ).trim();
  const variationProps = variantIsObject
    ? Array.isArray(variant.variation_props)
      ? variant.variation_props
      : null
    : Array.isArray(item.variation_props)
      ? item.variation_props
      : null;
  const bostaSkuCode = String(
    item.bosta_sku ?? item.bostaSku ?? item.variant?.sku ?? "",
  ).trim();
  const bostaSkuName = String(item.bosta_name ?? item.bostaName ?? item.variant?.name ?? "").trim();
  return {
    key: `line-${idx}-${sku || "sku"}-${price}-${quantity}`,
    sku,
    name,
    variant: variantIsObject ? "" : String(variant ?? item.variant_name ?? item.variant_label ?? ""),
    variationProp,
    quantity,
    price,
    catalogProductId,
    catalogProductKey,
    catalogOptionId: "",
    variantOptions: [],
    selectedVariantId: productVariantId,
    productVariantId,
    variationProps,
    selectedVariantData: variantIsObject ? variant : null,
    variationLabel: "",
    variantsLoading: false,
    bostaSkuOptions: [],
    bostaProductLabel: "",
    selectedBostaSkuCode: bostaSkuCode,
    selectedBostaSkuData: bostaSkuCode
      ? { skuCode: bostaSkuCode, name: bostaSkuName || bostaSkuCode }
      : null,
    bostaSkusLoading: false,
    bostaRecommendedSku: "",
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
  const returnTo = location.state?.returnTo ?? appHref("orders");
  const order = location.state?.order ?? null;
  const ordersListState = location.state?.ordersListState ?? null;

  const [cartItems, setCartItems] = useState([]);
  const { catalogProducts, catalogLoading, onCatalogSearchChange } =
    useProductCatalog(cartItems);
  const [form, setForm] = useState({
    orderAlias: "",
    firstLine: "",
    cityName: "",
    cityId: "",
    districtId: "",
    note: "",
    allowToOpenPackage: true,
    firstName: "",
    mobile: "",
    mobile2: "",
    type: "FORWARD",
    shipping_cost: "",
    payment_method: "cod",
    order_type: "new",
    order_source: "store",
    shipping_status: "in_progress",
  });
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    variant: "success",
    message: "",
  });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [sendingToBosta, setSendingToBosta] = useState(false);
  const [localStatusHistory, setLocalStatusHistory] = useState([]);

  useEffect(() => {
    if (!order) return;

    const sourceItems = Array.isArray(order.lineItems)
      ? order.lineItems
      : Array.isArray(order.cart_items)
        ? order.cart_items
        : [];

    setCartItems(sourceItems.map((item, idx) => cartRowFromOrderItem(item, idx)));

    let cancelled = false;
    (async () => {
      const rows = sourceItems.map((item, idx) => cartRowFromOrderItem(item, idx));
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const withVariants = await enrichCartRowWithVariants(row, {
            preselectedVariantId: row.productVariantId || row.selectedVariantId,
          });
          return enrichCartRowWithBostaSkus(withVariants, {
            preselectedSkuCode: row.selectedBostaSkuCode,
          });
        }),
      );
      if (!cancelled) setCartItems(enriched);
    })();

    setForm((prev) => ({
      ...prev,
      orderAlias: order.alias ?? order.shortId ?? "sec_order",
      firstLine:
        orderAddress(order) !== "—"
          ? orderAddress(order)
          : "102 street mohamed abd el shafy, alexandria",
      cityName: getOrderGovernmentName(order),
      cityId: pickOrderBostaCityId(order),
      districtId: pickOrderBostaDistrictId(order),
      note: String(order.note ?? order.notes ?? "").trim(),
      firstName: orderCustomer(order) !== "—" ? orderCustomer(order) : "ahmed",
      mobile: orderPhone(order) !== "—" ? orderPhone(order) : "01028687408",
      mobile2: orderSecondPhone(order) ?? "",
      shipping_cost: String(
        order.shipping_cost ??
          order.shippingCost ??
          order.totals?.shipping ??
          order.totals?.shippingCost ??
          "",
      ),
      payment_method: normalizeEasyOrderPaymentMethod(
        order.payment_method ??
          order["Payment Method"] ??
          order.totals?.paymentMethod ??
          (orderPayment(order) !== "—" ? orderPayment(order) : "cod"),
      ),
      order_type: normalizeOrderType(order.order_type ?? order.orderType),
      order_source: normalizeOrderSource(order.order_source ?? order.orderSource),
      shipping_status: normalizeShippingStatus(
        order.shipping_status ?? order.shippingStatus,
      ),
    }));

    return () => {
      cancelled = true;
    };
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
    navigate(returnTo, {
      state: ordersListState ? { ordersListState } : undefined,
    });
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
      handleOpenSendToBostaModal();
    }
  }

  function handleConfirmOnly() {
    applyStatus("تم التأكيد");
  }

  function handleCloseConfirmModal() {
    setIsConfirmModalOpen(false);
  }

  function handleOpenSendToBostaModal() {
    if (!orderIdForStatusUpdate) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "لا يوجد رقم طلب صالح للإرسال إلى بوسطة",
      });
      return;
    }
    const { cityId, districtId } = resolveBostaLocationForSend(form, order);
    if (!cityId) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "اختاري المحافظة قبل الإرسال إلى بوسطة",
      });
      return;
    }
    if (!districtId) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "اختاري المنطقة قبل الإرسال إلى بوسطة",
      });
      return;
    }
    setIsConfirmModalOpen(true);
  }

  async function handleSendToBosta() {
    if (!orderIdForStatusUpdate) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "لا يوجد رقم طلب صالح للإرسال إلى بوسطة",
      });
      return;
    }
    const { cityId, districtId } = resolveBostaLocationForSend(form, order);
    if (!cityId || !districtId) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "المحافظة والمنطقة مطلوبتان للإرسال إلى بوسطة",
      });
      return;
    }

    const bostaSkuResult = resolveBostaSkuForSend(cartItems);
    if (bostaSkuResult.error) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: bostaSkuResult.error,
      });
      return;
    }

    try {
      setSendingToBosta(true);
      await sendOrderToBosta(orderIdForStatusUpdate, {
        cityId,
        districtId,
        note: form.note,
        allowToOpenPackage: form.allowToOpenPackage,
        bostaSku: bostaSkuResult.bostaSku,
      });
      setIsConfirmModalOpen(false);
      setFeedbackModal({
        open: true,
        variant: "success",
        message: "تم إرسال الطلب إلى بوسطة بنجاح",
      });
    } catch (error) {
      console.error("[send-to-bosta]", error?.response?.data ?? error);
      setFeedbackModal({
        open: true,
        variant: "error",
        message: formatApiErrorMessage(error, "تعذر إرسال الطلب إلى بوسطة"),
      });
    } finally {
      setSendingToBosta(false);
    }
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

    const variantErrors = validateCartRowsVariants(linesForPayload);
    if (variantErrors.length > 0) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: variantErrors.join("\n"),
      });
      return;
    }

    const bostaErrors = validateCartRowsBostaSkus(linesForPayload);
    if (bostaErrors.length > 0) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: bostaErrors.join("\n"),
      });
      return;
    }

    const paymentMethodError = getPaymentMethodValidationError(form.payment_method);
    if (paymentMethodError) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: paymentMethodError,
      });
      return;
    }

    const paymentMethod = resolveEasyOrderPaymentMethod(form.payment_method);

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
      let productId =
        row.catalogProductId != null
          ? String(row.catalogProductId)
          : row.catalogProductKey || null;
      if (!productId && row.catalogOptionId) {
        const pi = catalogProducts.findIndex(
          (p, i) => productOptionId(p, i) === row.catalogOptionId,
        );
        if (pi !== -1) {
          const p = unwrapCatalogProduct(catalogProducts[pi]);
          const rid =
            p?.id ?? p?._id ?? p?.easyorder_id ?? parseProductRawData(p).id;
          if (rid != null && rid !== "") productId = String(rid);
        }
      }

      const line = {
        quantity: Number(row.quantity) || 1,
        price: Number(row.price) || 0,
        in_cart: false,
        product: {
          name: row.name,
          sku: row.sku,
          ...(productId ? { id: productId } : {}),
        },
        ...(productId ? { product_id: productId } : {}),
      };
      return finalizeCartLine(line, row, productId);
    });
    const payload = {
      full_name: form.firstName,
      phone: form.mobile,
      phone2: String(form.mobile2 ?? "").trim(),
      cityName: form.cityName,
      address: form.firstLine,
      status: backendStatus,
      cart_items: cartPayload,
      shipping_cost: parseNonNegativeMoney(form.shipping_cost),
      payment_method: paymentMethod,
      order_source: form.order_source,
      order_type: form.order_type,
      note: String(form.note ?? "").trim(),
      ...(showShipFields ? { shipping_status: form.shipping_status } : {}),
    };
    if (String(form.cityId ?? "").trim() || String(form.districtId ?? "").trim()) {
      appendBostaLocationIdsToPayload(payload, {
        cityId: form.cityId,
        districtId: form.districtId,
      });
    }

    try {
      setSavingOrder(true);
      await updateOrder(orderIdForStatusUpdate, payload);
      setFeedbackModal({
        open: true,
        variant: "success",
        message: "تم حفظ تعديلات الطلب بنجاح",
      });
    } catch (error) {
      console.log(error);
      const message = error?.response?.data?.message ?? "تعذر حفظ التعديلات";
      setFeedbackModal({
        open: true,
        variant: "error",
        message,
      });
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
            onClick={handleOpenSendToBostaModal}
            disabled={sendingToBosta || savingOrder}
            className="order-details-page__btn order-details-page__btn--soft"
          >
            {sendingToBosta ? "جاري الإرسال..." : "إرسال إلى بوسطة"}
          </button>
          <button
            type="button"
            onClick={handleSaveOrderChanges}
            disabled={savingOrder || sendingToBosta}
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
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
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
                    placeholder="01xxxxxxxxx"
                    value={form.mobile2}
                    onChange={(e) => setField("mobile2", e.target.value)}
                  />
                </label>
              </div>
              <BostaCityDistrictFields
                cityId={form.cityId}
                districtId={form.districtId}
                cityNameHint={form.cityName}
                districtNameHint={parseDistrictHintFromAddress(
                  orderAddress(order) !== "—" ? orderAddress(order) : form.firstLine,
                  form.cityName,
                )}
                onCityChange={(cityId, cityOption) =>
                  setForm((prev) => ({
                    ...prev,
                    cityId,
                    districtId: "",
                    cityName: cityOption ? bostaCityLabel(cityOption) : prev.cityName,
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
                العنوان
                <input
                  className="order-details-page__input"
                  value={form.firstLine}
                  onChange={(e) => setField("firstLine", e.target.value)}
                />
              </label>
              <label className="order-details-page__field order-details-page__field--full">
                ملاحظات
                <textarea
                  className="order-details-page__input order-details-page__note"
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="ملاحظات على الطلب (اختياري)"
                  rows={3}
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
            {form.mobile2 ? (
              <div className="order-details-page__summary-row">
                <span>هاتف إضافي</span>
                <strong>{form.mobile2}</strong>
              </div>
            ) : null}
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
              <strong>{paymentMethodOptionLabel(form.payment_method)}</strong>
            </div>
           
            <div className="order-details-page__summary-row">
              <span>مبلغ التحصيل</span>
              <strong>{collectionTotalDisplay} ج</strong>
            </div>
          </div>
        </aside>
      </div>
      <FeedbackModal
        open={feedbackModal.open}
        variant={feedbackModal.variant}
        message={feedbackModal.message}
        onClose={() =>
          setFeedbackModal((prev) => ({ ...prev, open: false }))
        }
      />

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
                disabled={sendingToBosta}
                style={{
                  background: "#16a085",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  opacity: sendingToBosta ? 0.7 : 1,
                }}
              >
                {sendingToBosta ? "جاري الإرسال..." : "تأكيد الإرسال"}
              </button>
              <button
                type="button"
                onClick={handleCloseConfirmModal}
                disabled={sendingToBosta}
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
