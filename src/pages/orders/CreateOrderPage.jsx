import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrder, getZones } from "../../api/ordersApi";
import "./CreateOrderPage.css";

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
    <div className="create-order-page">
      <div className="create-order-page__topbar">
        <div className="create-order-page__title">
          <h1>إنشاء طلب جديد</h1>
          <p>أدخلي بيانات الطلب وسيتم إرساله مباشرة للنظام.</p>
        </div>
        <button type="button" onClick={handleBack} className="create-order-page__btn create-order-page__btn--outline">
          رجوع
        </button>
      </div>

      <div className="create-order-page__grid">
        <section className="create-order-page__card">
          <h3>معلومات المنتج</h3>
          <div className="create-order-page__fields create-order-page__fields--two">
            <label className="create-order-page__label">
              كود المنتج (SKU)
              <input
                className="create-order-page__input"
                value={form.skuCode}
                onChange={(e) => setField("skuCode", e.target.value)}
              />
            </label>
            <label className="create-order-page__label">
              الكمية
              <input
                className="create-order-page__input"
                type="number"
                value={form.quantity}
                onChange={(e) => setField("quantity", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="create-order-page__card">
          <h3>بيانات العميل</h3>
          <div className="create-order-page__fields create-order-page__fields--two">
            <label className="create-order-page__label">
              اسم العميل
              <input
                className="create-order-page__input"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
              />
            </label>
            <label className="create-order-page__label">
              رقم الموبايل
              <input
                className="create-order-page__input"
                value={form.mobile}
                onChange={(e) => setField("mobile", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="create-order-page__card create-order-page__card--full">
          <h3>العنوان</h3>
          <div className="create-order-page__fields create-order-page__fields--two">
            <label className="create-order-page__label">
              المدينة
              <select
                className="create-order-page__input"
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
            <label className="create-order-page__label">
              المنطقة
              <select
                className="create-order-page__input"
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
            <label className="create-order-page__label create-order-page__card--full">
              العنوان (السطر الأول)
              <input
                className="create-order-page__input"
                value={form.firstLine}
                onChange={(e) => setField("firstLine", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="create-order-page__card">
          <h3>التسعير</h3>
          <div className="create-order-page__fields create-order-page__fields--two">
            <label className="create-order-page__label">
              السعر
              <input
                className="create-order-page__input"
                type="number"
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
              />
            </label>
            <label className="create-order-page__label">
              مبلغ التحصيل (COD)
              <input
                className="create-order-page__input"
                value={form.codAmount}
                onChange={(e) => setField("codAmount", e.target.value)}
              />
            </label>
            <label className="create-order-page__label">
              السماح بفتح الشحنة
              <select
                className="create-order-page__input"
                value={String(form.allowToOpenPackage)}
                onChange={(e) => setField("allowToOpenPackage", e.target.value === "true")}
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </label>
          </div>
        </section>

        <section className="create-order-page__card">
          <h3>ملاحظات</h3>
          <div className="create-order-page__fields">
            <label className="create-order-page__label">
              ملاحظات الطلب
              <textarea
                className="create-order-page__textarea"
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="create-order-page__footer">
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={creating}
          className="create-order-page__create-btn"
        >
          {creating ? "جاري الإنشاء..." : "إنشاء الطلب"}
        </button>
      </div>
    </div>
  );
}
