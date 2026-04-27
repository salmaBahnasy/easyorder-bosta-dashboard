import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrder, getZones } from "../api/ordersApi";

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
    navigate("/orders");
  }

  async function handleCreateOrder() {
    const payload = {
      id: form.orderAlias?.trim() || `manual-order-${Date.now()}`,
      full_name: form.firstName?.trim() || "Customer",
      phone: form.mobile?.trim() || "",
      total: Number(form.codAmount || form.price || 0),
    };

    if (!payload.phone) {
      alert("رقم الموبايل مطلوب");
      return;
    }

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

      <h2 style={{ marginTop: 0 }}>إنشاء طلب جديد</h2>

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
          كود المنتج (SKU)
          <input
            value={form.skuCode}
            onChange={(e) => setField("skuCode", e.target.value)}
          />
        </label>
        <label>
          الكمية
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setField("quantity", e.target.value)}
          />
        </label>
        <label>
          السعر
          <input
            type="number"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
          />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          العنوان (السطر الأول)
          <input
            style={{ width: "100%" }}
            value={form.firstLine}
            onChange={(e) => setField("firstLine", e.target.value)}
          />
        </label>
        <label>
          المدينة
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
          المنطقة
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
         سعر الطلب 
          <input
            value={form.codAmount}
            onChange={(e) => setField("codAmount", e.target.value)}
          />
        </label>
        <label>
        سعر الشحن
          <input
            value={form.codAmount}
            onChange={(e) => setField("codAmount", e.target.value)}
          />
        </label><label>
         اجمالي الطلب
          <input
            value={form.codAmount}
            onChange={(e) => setField("codAmount", e.target.value)}
          />
        </label><label>
          مبلغ التحصيل (COD)
          <input
            value={form.codAmount}
            onChange={(e) => setField("codAmount", e.target.value)}
          />
        </label>
        <label>
          السماح بفتح الشحنة
          <select
            value={String(form.allowToOpenPackage)}
            onChange={(e) =>
              setField("allowToOpenPackage", e.target.value === "true")
            }
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          ملاحظات
          <input
            style={{ width: "100%" }}
            value={form.note}
            onChange={(e) => setField("note", e.target.value)}
          />
        </label>
        <label>
          اسم العميل
          <input
            value={form.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
          />
        </label>
        <label>
          رقم الموبايل
          <input
            value={form.mobile}
            onChange={(e) => setField("mobile", e.target.value)}
          />
        </label>
        {/* <label style={{ gridColumn: "1 / -1" }}>
          Webhook URL
          <input
            style={{ width: "100%" }}
            value={form.webhookUrl}
            onChange={(e) => setField("webhookUrl", e.target.value)}
          />
        </label> */}
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-start" }}>
        <button type="button" onClick={handleCreateOrder} disabled={creating}>
          {creating ? "جاري الإنشاء..." : "إنشاء الطلب"}
        </button>
      </div>

    
    </div>
  );
}
