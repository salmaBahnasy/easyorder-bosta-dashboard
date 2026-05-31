import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProduct } from "../../api/ordersApi";
import { appHref } from "../../utils/auth";
import {
  emptyProductForm,
  formToProductPayload,
  ProductFormFields,
} from "./ProductFormFields";
import "./ProductEditorPage.css";

export default function CreateProductPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

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
      await createProduct(formToProductPayload(form));
      alert("تم إنشاء المنتج بنجاح");
      navigate(appHref("products"));
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ?? "تعذر إنشاء المنتج، تحققي من البيانات والـ API";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="product-editor">
      <header className="product-editor__header">
        <div>
          <h1>إضافة منتج</h1>
          <p>أدخلي بيانات المنتج الجديد ثم احفظي.</p>
        </div>
        <button
          type="button"
          className="product-editor__back"
          onClick={() => navigate(appHref("products"))}
        >
          ← العودة للمنتجات
        </button>
      </header>

      <div className="product-editor__card">
        <form className="product-editor__form" onSubmit={handleSubmit}>
          <ProductFormFields form={form} setField={setField} />
          <div className="product-editor__actions">
            <button
              type="submit"
              className="product-editor__btn product-editor__btn--primary"
              disabled={saving}
            >
              {saving ? "جاري الحفظ..." : "حفظ المنتج"}
            </button>
            <button
              type="button"
              className="product-editor__btn product-editor__btn--outline"
              onClick={() => navigate(appHref("products"))}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
