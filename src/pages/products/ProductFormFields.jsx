export const emptyProductForm = {
  name: "",
  sku: "",
  price: "",
  quantity: "",
  thumb: "",
};

export function recordToProductForm(record) {
  if (!record) return { ...emptyProductForm };
  const r = record?.data ?? record?.product ?? record;
  return {
    name: r?.name ?? r?.title ?? "",
    sku: r?.sku ?? r?.code ?? "",
    price: r?.price != null && r?.price !== "" ? String(r.price) : "",
    quantity:
      r?.quantity != null && r?.quantity !== "" ? String(r.quantity) : "",
    thumb:
      r?.thumb ??
      r?.thumbnail ??
      r?.image ??
      r?.image_url ??
      "",
  };
}

export function formToProductPayload(form) {
  return {
    name: form.name.trim(),
    sku: form.sku.trim(),
    price: Number(form.price),
    quantity: Number(form.quantity) || 0,
    ...(form.thumb.trim() ? { thumb: form.thumb.trim() } : {}),
  };
}

export function ProductFormFields({ form, setField }) {
  return (
    <>
      <label className="product-editor__field">
        اسم المنتج
        <input
          className="product-editor__input"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
      </label>

      <label className="product-editor__field">
        SKU / الرمز
        <input
          className="product-editor__input"
          value={form.sku}
          onChange={(e) => setField("sku", e.target.value)}
          required
        />
      </label>

      <label className="product-editor__field">
        السعر (ج)
        <input
          className="product-editor__input"
          type="number"
          min="0"
          step="any"
          value={form.price}
          onChange={(e) => setField("price", e.target.value)}
          required
        />
      </label>

      <label className="product-editor__field">
        الكمية
        <input
          className="product-editor__input"
          type="number"
          min="0"
          step="1"
          value={form.quantity}
          onChange={(e) => setField("quantity", e.target.value)}
          required
        />
      </label>

      <label className="product-editor__field product-editor__field--full">
        رابط الصورة (اختياري)
        <input
          className="product-editor__input"
          type="url"
          value={form.thumb}
          onChange={(e) => setField("thumb", e.target.value)}
          placeholder="https://..."
        />
      </label>
    </>
  );
}
