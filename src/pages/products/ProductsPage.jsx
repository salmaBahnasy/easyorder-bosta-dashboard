import { useEffect, useMemo, useState } from "react";
import { getExternalProducts } from "../../api/easyOrdersApi";
import { colors } from "../../constants/colors";
import "./ProductsPage.css";

function normalizeProductList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.products)) return payload.products;
  if (payload.data?.data && Array.isArray(payload.data.data))
    return payload.data.data;
  return [];
}

/** يقرأ كائن raw_data أو يفكّه لو كان نص JSON (احتياطي) */
function getRawDataFields(item) {
  let rd = item?.raw_data;
  if (rd == null) return {};
  if (typeof rd === "string") {
    try {
      rd = JSON.parse(rd);
    } catch {
      return {};
    }
  }
  return rd && typeof rd === "object" && !Array.isArray(rd) ? rd : {};
}

/**
 * Easy Orders يرجع الحقول على جذر العنصر: name, price, thumb, quantity
 * نفس الدالة تدعم احتياطًا من raw_data إن وُجد.
 */
function getProductDisplayFields(item) {
  const rd = getRawDataFields(item);
  const name =
    item?.name ?? item?.title ?? rd.name ?? rd.title ?? "—";
  const price =
    item?.price != null && item?.price !== ""
      ? item.price
      : rd.price != null && rd.price !== ""
        ? rd.price
        : null;
  const thumbUrl =
    item?.thumb ??
    item?.thumbnail ??
    rd.thumb ??
    rd.thumbnail ??
    rd.image ??
    rd.image_url ??
    "";
  const quantity =
    item?.quantity != null && item?.quantity !== ""
      ? item.quantity
      : rd.quantity != null && rd.quantity !== ""
        ? rd.quantity
        : null;

  return {
    name,
    priceLabel: price != null ? `${price}` : "—",
    thumbUrl,
    quantityLabel: quantity != null ? String(quantity) : "—",
  };
}

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasApiKey = Boolean(import.meta.env.VITE_EASY_ORDERS_API_KEY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasApiKey) {
        setLoading(false);
        setError(null);
        setRaw(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await getExternalProducts({
          page,
          limit,
          search: activeSearch,
        });
        if (!cancelled) setRaw(data);
      } catch (e) {
        console.log(e);
        if (!cancelled) {
          setError(
            e?.response?.data?.message ??
              "تعذر تحميل المنتجات من Easy Orders (تحققي من المفتاح والشبكة وCORS)."
          );
          setRaw(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, activeSearch, hasApiKey]);

  function handleSearchSubmit(e) {
    e?.preventDefault?.();
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  const products = useMemo(() => normalizeProductList(raw), [raw]);

  const totalPages =
    raw?.totalPages ??
    raw?.pagination?.totalPages ??
    (raw?.total != null && limit
      ? Math.ceil(Number(raw.total) / limit)
      : null);

  return (
    <div className="products-page">
      <section className="products-page__header">
        <div>
          <h1>المنتجات</h1>
          <p>إدارة وعرض منتجات المتجر بشكل حديث وسريع.</p>
        </div>
        <button
          type="button"
          className="products-page__add-btn"
          onClick={() => alert("صفحة إضافة منتج سيتم تنفيذها قريبًا")}
        >
          + إضافة منتج
        </button>
      </section>

      <form className="products-page__toolbar" onSubmit={handleSearchSubmit}>
        <input
          className="products-page__search-input"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحثي باسم المنتج..."
        />
        <button type="submit" className="products-page__toolbar-btn">
          بحث
        </button>
        {activeSearch ? (
          <button
            type="button"
            className="products-page__toolbar-btn products-page__toolbar-btn--outline"
            onClick={handleClearSearch}
          >
            مسح
          </button>
        ) : null}
      </form>

      {!hasApiKey ? (
        <div className="products-page__warning">
          <strong>مفتاح Easy Orders غير مضبوط.</strong> أضيفي في ملف{" "}
          <code>.env</code>:
          <pre className="products-page__warning-code">
            VITE_EASY_ORDERS_API_KEY=your_api_key_here
          </pre>
          ثم أعدي تشغيل <code>npm run dev</code>. الترويسة المرسلة:{" "}
          <code>Api-Key</code>.
        </div>
      ) : null}

      {!hasApiKey ? null : loading ? (
        <p className="products-page__state">جاري تحميل المنتجات...</p>
      ) : error ? (
        <p className="products-page__state products-page__state--error">{error}</p>
      ) : products.length === 0 ? (
        <p className="products-page__state">لا توجد منتجات في الاستجابة.</p>
      ) : (
        <>
          <div className="products-grid">
            {products.map((item, index) => {
              const id = item?.id ?? item?.sku ?? index;
              const { name, priceLabel, thumbUrl } = getProductDisplayFields(item);
              return (
                <article key={String(id)} className="product-card">
                  <div className="product-card__image-wrap">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={name} className="product-card__image" />
                    ) : (
                      <span className="product-card__image-placeholder">لا توجد صورة</span>
                    )}
                  </div>

                  <div className="product-card__content">
                    <h3>{name}</h3>
                    <p>{priceLabel !== "—" ? `${priceLabel} ج` : "—"}</p>
                  </div>

                  <div className="product-card__actions">
                    <button
                      type="button"
                      className="product-card__action-btn product-card__action-btn--edit"
                      onClick={() => alert(`تعديل المنتج: ${name}`)}
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      type="button"
                      className="product-card__action-btn product-card__action-btn--delete"
                      onClick={() => alert(`حذف المنتج: ${name}`)}
                    >
                      🗑 حذف
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {(totalPages != null && totalPages > 1) || page > 1 ? (
            <div className="products-page__pagination">
              <button
                type="button"
                className="products-page__toolbar-btn products-page__toolbar-btn--outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </button>
              <span>
                صفحة {page}
                {totalPages != null ? ` من ${totalPages}` : ""}
              </span>
              <button
                type="button"
                className="products-page__toolbar-btn"
                style={{ backgroundColor: colors.primaryBlue, color: "#fff" }}
                disabled={
                  loading ||
                  (totalPages != null ? page >= totalPages : products.length < limit)
                }
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
