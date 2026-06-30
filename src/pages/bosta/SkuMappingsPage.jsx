import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSkuMapping,
  deleteSkuMapping,
  deleteUnmappedSku,
  getSkuMappings,
  importSkuMappings,
  updateSkuMapping,
} from "../../api/ordersApi";
import FeedbackModal from "../../components/FeedbackModal";
import "./SkuMappingsPage.css";

const MAPPING_TYPE_OPTIONS = [
  { value: "product", label: "منتج (product)" },
  { value: "variant", label: "مقاس (variant)" },
  { value: "size", label: "حجم (size)" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "product", label: "منتجات" },
  { value: "variant", label: "مقاسات" },
  { value: "size", label: "أحجام" },
  { value: "unmapped", label: "غير مربوط" },
];

const TYPE_LABELS = {
  product: "منتج",
  variant: "مقاس",
  size: "حجم",
  unmapped: "غير مربوط",
};

const initialForm = {
  mappingType: "product",
  entityId: "",
  productId: "",
  name: "",
  size: "",
  skusText: "",
};

function parseSkusText(text) {
  return String(text ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function skusToText(skus) {
  if (!Array.isArray(skus)) return "";
  return skus.map((s) => String(s).trim()).filter(Boolean).join("\n");
}

function mappingRowKey(row) {
  const type = String(row?.mappingType ?? row?.type ?? "unknown").trim();
  const id = String(
    row?.entityId ?? row?.id ?? row?._id ?? row?.productId ?? "",
  ).trim();
  return `${type}-${id}`;
}

function mapSkuObjectToRows(mapObj, mappingType) {
  if (!mapObj || typeof mapObj !== "object" || Array.isArray(mapObj)) return [];
  return Object.entries(mapObj).map(([entityId, value]) => ({
    mappingType,
    entityId: String(entityId).trim(),
    name: String(value?.name ?? "").trim(),
    skus: Array.isArray(value?.skus) ? value.skus : [],
    productId: String(value?.productId ?? "").trim(),
    size: value?.size != null ? String(value.size).trim() : "",
  }));
}

function normalizeMappingsResponse(data) {
  const items = [];
  const unmapped = [];

  const root =
    data && typeof data === "object" && data.data && typeof data.data === "object"
      ? data.data
      : data?.data ?? data;

  if (root?.productSkuMap || root?.variantSkuMap || root?.sizeSkuMap) {
    items.push(...mapSkuObjectToRows(root.productSkuMap, "product"));
    items.push(...mapSkuObjectToRows(root.variantSkuMap, "variant"));
    items.push(...mapSkuObjectToRows(root.sizeSkuMap, "size"));
  }

  const unmappedBucket = root?.unmappedProducts ?? root?.unmapped;
  if (Array.isArray(unmappedBucket)) {
    unmapped.push(
      ...unmappedBucket.map((row) => {
        const productId = String(row?.productId ?? row?.entityId ?? row?.id ?? "").trim();
        return {
          mappingType: "unmapped",
          entityId: productId,
          productId,
          name: String(row?.name ?? "").trim(),
          reason: String(row?.reason ?? "").trim(),
          skus: [],
        };
      }),
    );
  }

  if (items.length === 0 && unmapped.length === 0) {
    if (Array.isArray(data)) {
      for (const row of data) {
        const type = String(row?.mappingType ?? row?.type ?? "").trim().toLowerCase();
        if (type === "unmapped") unmapped.push({ ...row, mappingType: "unmapped" });
        else items.push({ ...row, mappingType: type || "product" });
      }
      return { items, unmapped };
    }

    if (Array.isArray(root?.mappings)) {
      for (const row of root.mappings) {
        const type = String(row?.mappingType ?? row?.type ?? "").trim().toLowerCase();
        if (type === "unmapped") unmapped.push({ ...row, mappingType: "unmapped" });
        else items.push({ ...row, mappingType: type || "product" });
      }
    }

    for (const type of ["product", "variant", "size"]) {
      const bucket = root?.[`${type}s`] ?? root?.[type];
      if (Array.isArray(bucket)) {
        items.push(
          ...bucket.map((row) => ({
            ...row,
            mappingType: String(row?.mappingType ?? type).trim().toLowerCase(),
          })),
        );
      }
    }
  }

  return { items, unmapped };
}

function buildCreatePayload(form) {
  const mappingType = String(form.mappingType ?? "product").trim();
  const entityId = String(form.entityId ?? "").trim();
  const name = String(form.name ?? "").trim();
  const skus = parseSkusText(form.skusText);

  const payload = { mappingType, entityId, name, skus };

  if (mappingType === "variant") {
    payload.productId = String(form.productId ?? "").trim();
    payload.size = String(form.size ?? "").trim();
  }

  return payload;
}

function buildUpdatePayload(form, mappingType) {
  const payload = {
    name: String(form.name ?? "").trim(),
    skus: parseSkusText(form.skusText),
  };
  if (mappingType === "variant") {
    payload.size = String(form.size ?? "").trim();
  }
  return payload;
}

export default function SkuMappingsPage() {
  const formRef = useRef(null);
  const [items, setItems] = useState([]);
  const [unmapped, setUnmapped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    variant: "success",
    message: "",
  });

  async function loadMappings() {
    try {
      setLoading(true);
      const data = await getSkuMappings();
      const parsed = normalizeMappingsResponse(data);
      setItems(parsed.items);
      setUnmapped(parsed.unmapped);
    } catch (error) {
      console.log(error);
      setFeedbackModal({
        open: true,
        variant: "error",
        message: error?.response?.data?.message ?? "تعذر تحميل ربط SKU",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMappings();
  }, []);

  const visibleRows = useMemo(() => {
    if (filter === "unmapped") return unmapped;
    if (filter === "all") return [...items, ...unmapped];
    return items.filter(
      (row) => String(row.mappingType ?? "").toLowerCase() === filter,
    );
  }, [filter, items, unmapped]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditing(null);
  }

  function startAdd() {
    resetForm();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(row) {
    const mappingType = String(row?.mappingType ?? "product").trim().toLowerCase();
    setEditing({
      mappingType,
      entityId: String(row?.entityId ?? row?.id ?? row?._id ?? "").trim(),
    });
    setForm({
      mappingType,
      entityId: String(row?.entityId ?? row?.id ?? row?._id ?? "").trim(),
      productId: String(row?.productId ?? "").trim(),
      name: String(row?.name ?? "").trim(),
      size: String(row?.size ?? "").trim(),
      skusText: skusToText(row?.skus),
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const mappingType = String(form.mappingType ?? "").trim();
    const entityId = String(form.entityId ?? "").trim();
    const skus = parseSkusText(form.skusText);

    if (!entityId) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "معرّف الكيان (entityId) مطلوب",
      });
      return;
    }
    if (!String(form.name ?? "").trim()) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "الاسم مطلوب",
      });
      return;
    }
    if (skus.length === 0) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "أدخلي SKU واحد على الأقل",
      });
      return;
    }
    if (mappingType === "variant" && !String(form.productId ?? "").trim()) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "productId مطلوب لربط المقاس (variant)",
      });
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await updateSkuMapping(
          editing.mappingType,
          editing.entityId,
          buildUpdatePayload(form, editing.mappingType),
        );
        setFeedbackModal({
          open: true,
          variant: "success",
          message: "تم تحديث الربط بنجاح",
        });
      } else {
        await createSkuMapping(buildCreatePayload(form));
        setFeedbackModal({
          open: true,
          variant: "success",
          message: "تم إضافة الربط بنجاح",
        });
      }
      resetForm();
      await loadMappings();
    } catch (error) {
      console.log(error);
      setFeedbackModal({
        open: true,
        variant: "error",
        message: error?.response?.data?.message ?? "تعذر حفظ الربط",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    const mappingType = String(row?.mappingType ?? "").trim().toLowerCase();
    const isUnmapped = mappingType === "unmapped";
    const entityId = String(
      isUnmapped
        ? row?.productId ?? row?.entityId ?? row?.id ?? ""
        : row?.entityId ?? row?.id ?? row?._id ?? "",
    ).trim();

    if (!entityId) return;

    const ok = window.confirm(
      isUnmapped ? "حذف هذا السجل من غير المربوط؟" : "حذف هذا الربط؟",
    );
    if (!ok) return;

    try {
      if (isUnmapped) {
        await deleteUnmappedSku(entityId);
      } else {
        await deleteSkuMapping(mappingType, entityId);
      }
      if (
        editing &&
        editing.mappingType === mappingType &&
        editing.entityId === entityId
      ) {
        resetForm();
      }
      await loadMappings();
      setFeedbackModal({
        open: true,
        variant: "success",
        message: "تم الحذف بنجاح",
      });
    } catch (error) {
      console.log(error);
      setFeedbackModal({
        open: true,
        variant: "error",
        message: error?.response?.data?.message ?? "تعذر الحذف",
      });
    }
  }

  async function handleImport() {
    const raw = String(importJson ?? "").trim();
    if (!raw) {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "الصقي JSON للاستيراد",
      });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      setFeedbackModal({
        open: true,
        variant: "error",
        message: "JSON غير صالح",
      });
      return;
    }

    const ok = window.confirm(
      "الاستيراد يستبدل كل بيانات الربط الحالية. هل تريدين المتابعة؟",
    );
    if (!ok) return;

    try {
      setImporting(true);
      await importSkuMappings(payload);
      setImportOpen(false);
      setImportJson("");
      await loadMappings();
      setFeedbackModal({
        open: true,
        variant: "success",
        message: "تم استيراد البيانات بنجاح",
      });
    } catch (error) {
      console.log(error);
      setFeedbackModal({
        open: true,
        variant: "error",
        message: error?.response?.data?.message ?? "تعذر الاستيراد",
      });
    } finally {
      setImporting(false);
    }
  }

  const showProductId = form.mappingType === "variant";
  const showSize = form.mappingType === "variant";
  const isEditing = Boolean(editing);

  return (
    <div className="sku-mappings-page">
      <section className="sku-mappings-page__header">
        <div>
          <h1>ربط SKU بوسطة</h1>
          <p>إدارة ربط منتجات EasyOrder بأكواد SKU في بوسطة (product / variant / size).</p>
        </div>
        <div className="sku-mappings-page__header-actions">
          <button
            type="button"
            className="sku-mappings-page__btn sku-mappings-page__btn--outline"
            onClick={() => setImportOpen(true)}
          >
            استيراد JSON
          </button>
          <button
            type="button"
            className="sku-mappings-page__btn sku-mappings-page__btn--primary"
            onClick={startAdd}
          >
            + إضافة ربط
          </button>
        </div>
      </section>

      <div className="sku-mappings-page__filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`sku-mappings-page__filter ${filter === opt.value ? "sku-mappings-page__filter--active" : ""}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            {opt.value === "all"
              ? ` (${items.length + unmapped.length})`
              : opt.value === "unmapped"
                ? ` (${unmapped.length})`
                : ` (${items.filter((r) => r.mappingType === opt.value).length})`}
          </button>
        ))}
      </div>

      <section ref={formRef} className="sku-mappings-page__card sku-mappings-page__form-card">
        <h2>{isEditing ? "تعديل ربط" : "إضافة ربط جديد"}</h2>
        <form className="sku-mappings-page__form-grid" onSubmit={handleSubmit}>
          <label className="sku-mappings-page__field">
            نوع الربط
            <select
              className="sku-mappings-page__select"
              value={form.mappingType}
              disabled={isEditing}
              onChange={(e) => setField("mappingType", e.target.value)}
            >
              {MAPPING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sku-mappings-page__field">
            entityId
            <input
              className="sku-mappings-page__input"
              value={form.entityId}
              disabled={isEditing}
              onChange={(e) => setField("entityId", e.target.value)}
              placeholder="UUID للمنتج أو المقاس"
            />
          </label>

          {showProductId ? (
            <label className="sku-mappings-page__field">
              productId
              <input
                className="sku-mappings-page__input"
                value={form.productId}
                disabled={isEditing}
                onChange={(e) => setField("productId", e.target.value)}
                placeholder="UUID المنتج الأب"
              />
            </label>
          ) : null}

          <label className="sku-mappings-page__field">
            الاسم
            <input
              className="sku-mappings-page__input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="اسم العرض"
            />
          </label>

          {showSize ? (
            <label className="sku-mappings-page__field">
              المقاس (size)
              <input
                className="sku-mappings-page__input"
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
                placeholder="مثل: 160"
              />
            </label>
          ) : null}

          <label className="sku-mappings-page__field sku-mappings-page__field--full">
            أكواد SKU (سطر أو فاصلة لكل كود)
            <textarea
              className="sku-mappings-page__textarea"
              value={form.skusText}
              onChange={(e) => setField("skusText", e.target.value)}
              placeholder={"bo-2936338\nbo-1708979"}
            />
            <p className="sku-mappings-page__hint">مثال: bo-2936338, bo-1708979</p>
          </label>

          <div className="sku-mappings-page__form-actions">
            <button
              type="submit"
              className="sku-mappings-page__btn sku-mappings-page__btn--primary"
              disabled={saving}
            >
              {saving ? "جاري الحفظ..." : isEditing ? "حفظ التعديل" : "إضافة"}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="sku-mappings-page__btn sku-mappings-page__btn--outline"
                onClick={resetForm}
                disabled={saving}
              >
                إلغاء
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="sku-mappings-page__card">
        {loading ? (
          <p className="sku-mappings-page__loading">جاري تحميل الربط...</p>
        ) : visibleRows.length === 0 ? (
          <p className="sku-mappings-page__empty">لا توجد سجلات في هذا التصنيف.</p>
        ) : (
          <div className="sku-mappings-page__table-wrap">
            <table className="sku-mappings-page__table">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>الاسم</th>
                  <th>entityId</th>
                  <th>productId</th>
                  <th>المقاس</th>
                  <th>SKUs</th>
                  <th>ملاحظة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const type = String(row?.mappingType ?? "product").toLowerCase();
                  const isUnmapped = type === "unmapped";
                  const entityId = String(
                    row?.entityId ?? row?.productId ?? row?.id ?? row?._id ?? "",
                  ).trim();
                  const skus = Array.isArray(row?.skus) ? row.skus : [];
                  return (
                    <tr key={mappingRowKey(row)}>
                      <td>
                        <span
                          className={`sku-mappings-page__type-badge sku-mappings-page__type-badge--${type}`}
                        >
                          {TYPE_LABELS[type] ?? type}
                        </span>
                      </td>
                      <td>{row?.name ?? "—"}</td>
                      <td>
                        <span className="sku-mappings-page__mono">{entityId || "—"}</span>
                      </td>
                      <td>
                        <span className="sku-mappings-page__mono">
                          {row?.productId && row.productId !== entityId
                            ? row.productId
                            : "—"}
                        </span>
                      </td>
                      <td>{row?.size ?? "—"}</td>
                      <td>
                        {skus.length > 0 ? (
                          <div className="sku-mappings-page__skus">
                            {skus.map((sku) => (
                              <span key={sku} className="sku-mappings-page__sku-tag">
                                {sku}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="sku-mappings-page__empty-skus">—</span>
                        )}
                      </td>
                      <td>
                        {row?.reason ? (
                          <span className="sku-mappings-page__reason">{row.reason}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="sku-mappings-page__row-actions">
                          {!isUnmapped ? (
                            <button type="button" onClick={() => startEdit(row)}>
                              تعديل
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="sku-mappings-page__delete-btn"
                            onClick={() => handleDelete(row)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {importOpen ? (
        <div
          className="sku-mappings-page__modal-backdrop"
          role="presentation"
          onClick={() => !importing && setImportOpen(false)}
        >
          <div
            className="sku-mappings-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sku-import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sku-import-title">استيراد ربط SKU</h3>
            <p>
              الصقي JSON كاملًا — سيتم استبدال كل بيانات الربط الحالية (POST
              /sku-mappings/import).
            </p>
            <textarea
              className="sku-mappings-page__textarea"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"productSkuMap":{},"variantSkuMap":{},"sizeSkuMap":{},"unmappedProducts":[]}'
              rows={12}
            />
            <div className="sku-mappings-page__modal-actions">
              <button
                type="button"
                className="sku-mappings-page__btn sku-mappings-page__btn--primary"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
              </button>
              <button
                type="button"
                className="sku-mappings-page__btn sku-mappings-page__btn--outline"
                onClick={() => setImportOpen(false)}
                disabled={importing}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FeedbackModal
        open={feedbackModal.open}
        variant={feedbackModal.variant}
        message={feedbackModal.message}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
