import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getOrderDetails, getZones } from "../api/ordersApi";
import { orderAddress, orderCustomer, orderDisplayId, orderPhone, orderTotalCost } from "../utils/orderDisplay";

function normalizeOrder(payload) {
  if (!payload || typeof payload !== "object") return null;
  let cur = payload.data ?? payload.order ?? payload;
  if (
    cur &&
    typeof cur === "object" &&
    cur.data &&
    typeof cur.data === "object" &&
    !Array.isArray(cur.data)
  ) {
    const inner = cur.data;
    if (
      inner.id ||
      inner.full_name ||
      inner["Order ID"] ||
      inner.phone
    ) {
      cur = inner;
    }
  }
  return cur;
}

export default function OrderDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const returnTo = location.state?.returnTo ?? "/orders";

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!orderId) {
        setLoading(false);
        setError("رقم الطلب غير موجود");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const result = await getOrderDetails(orderId);
        const data = normalizeOrder(result);
        if (!cancelled) {
          setOrder(data);
        }
      } catch (e) {
        console.log(e);
        if (!cancelled) {
          setError("تعذر تحميل تفاصيل الطلب من الخادم");
          setOrder(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

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
      price: String(firstItem.price ?? firstItem.unitPrice ?? orderTotalCost(order) ?? "100"),
      firstLine: orderAddress(order) !== "—" ? orderAddress(order) : "102 street mohamed abd el shafy, alexandria",
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

  if (loading) {
    return (
      <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial" }}>
        <button type="button" onClick={handleBack} style={{ marginBottom: 16 }}>
          رجوع
        </button>
        <p>جاري تحميل تفاصيل الطلب...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial" }}>
        <button type="button" onClick={handleBack} style={{ marginBottom: 16 }}>
          رجوع
        </button>
        <p>{error ?? `لا توجد بيانات للطلب #${orderId}`}</p>
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

  return (
    <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial" }}>
      <button type="button" onClick={handleBack} style={{ marginBottom: 16 }}>
        رجوع
      </button>

      <h2 style={{ marginTop: 0 }}>
        تفاصيل الطلب #{orderDisplayId(order)}
      </h2>

      <div
        style={{
          background: "#fff",
          padding: 16,
          border: "1px solid #ddd",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <label>
          Order Alias
          <input value={form.orderAlias} onChange={(e) => setField("orderAlias", e.target.value)} />
        </label>
        <label>
          SKU Code
          <input value={form.skuCode} onChange={(e) => setField("skuCode", e.target.value)} />
        </label>
        <label>
          Quantity
          <input type="number" value={form.quantity} onChange={(e) => setField("quantity", e.target.value)} />
        </label>
        <label>
          Price
          <input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          First Line
          <input style={{ width: "100%" }} value={form.firstLine} onChange={(e) => setField("firstLine", e.target.value)} />
        </label>
        <label>
          City
          <select
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
        <label>
          District
          <select
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
        <label>
          COD Amount
          <input value={form.codAmount} onChange={(e) => setField("codAmount", e.target.value)} />
        </label>
        <label>
          Allow Open Package
          <select
            value={String(form.allowToOpenPackage)}
            onChange={(e) => setField("allowToOpenPackage", e.target.value === "true")}
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Note
          <input style={{ width: "100%" }} value={form.note} onChange={(e) => setField("note", e.target.value)} />
        </label>
        <label>
          Customer First Name
          <input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
        </label>
        <label>
          Mobile
          <input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Webhook URL
          <input style={{ width: "100%" }} value={form.webhookUrl} onChange={(e) => setField("webhookUrl", e.target.value)} />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Payload Preview</h3>
        <textarea
          readOnly
          style={{ width: "100%", minHeight: 280, direction: "ltr" }}
          value={JSON.stringify(payloadPreview, null, 2)}
        />
      </div>
    </div>
  );
}
