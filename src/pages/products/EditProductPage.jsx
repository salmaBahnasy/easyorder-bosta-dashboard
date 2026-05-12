import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProductById, updateProduct } from "../../api/ordersApi";
import {
  formToProductPayload,
  ProductFormFields,
  recordToProductForm,
} from "./ProductFormFields";
import "./ProductEditorPage.css";

export default function EditProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [form, setForm] = useState(() => recordToProductForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!productId) {
        setLoadError("معرّف المنتج غير صالح");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setLoadError(null);
        const raw = await getProductById(productId);
        const record = raw?.data ?? raw?.product ?? raw;
        if (!cancelled) {
          setForm(recordToProductForm(record));
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setLoadError(
            error?.response?.data?.message ?? "تعذر تحميل بيانات المنتج",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim()) {
      alert("الاسم و SKU مطلوبان");
      return;
    }
    if (form.price === "" || Number.isNaN(Number(form.price))) {
      alert("أدخلي سعرًا صالحًا");
      return;
    }

    try {
      setSaving(true);
      await updateProduct(productId, formToProductPayload(form));
      alert("تم تحديث المنتج بنجاح");
      navigate("/products");
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ?? "تعذر حفظ التعديلات، تحققي من الـ API";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="product-editor">
      <header className="product-editor__header">
        <div>
          <h1>تعديل منتج</h1>
          <p>حدّثي الحقول ثم احفظي التغييرات.</p>
        </div>
        <button
          type="button"
          className="product-editor__back"
          onClick={() => navigate("/products")}
        >
          ← العودة للمنتجات
        </button>
      </header>

      <div className="product-editor__card">
        {loading ? (
          <p className="product-editor__state">جاري تحميل المنتج...</p>
        ) : loadError ? (
          <p className="product-editor__state product-editor__state--error">
            {loadError}
          </p>
        ) : (
          <form className="product-editor__form" onSubmit={handleSubmit}>
            <ProductFormFields form={form} setField={setField} />
            <div className="product-editor__actions">
              <button
                type="submit"
                className="product-editor__btn product-editor__btn--primary"
                disabled={saving}
              >
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
              <button
                type="button"
                className="product-editor__btn product-editor__btn--outline"
                onClick={() => navigate("/products")}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
