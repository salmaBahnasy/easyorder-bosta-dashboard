import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { appHref } from "../../utils/auth";
import { getProducts } from "../../api/ordersApi";
import { colors } from "../../constants/colors";
import { normalizeProductListFromApi } from "../../utils/normalizeProductListFromApi";
import { resolveEffectiveCatalogPrice } from "../../utils/catalogPrice";
import "./ProductsPage.css";

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
  const effectivePrice = resolveEffectiveCatalogPrice(item);
  const listPrice = Number(item?.price ?? rd.price ?? 0) || 0;
  const price = effectivePrice > 0 ? effectivePrice : null;
  const originalPrice =
    listPrice > 0 && effectivePrice > 0 && listPrice > effectivePrice
      ? listPrice
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

  let warrantyLabel = "";
  const w = item?.warranty ?? rd.warranty ?? rd.warranty_label;
  if (w != null && String(w).trim()) {
    warrantyLabel = String(w).trim();
  } else {
    const years = rd.warranty_years ?? item?.warranty_years;
    const n = Number(years);
    if (Number.isFinite(n) && n > 0) {
      warrantyLabel = n === 1 ? "ضمان سنة" : `ضمان ${n} سنوات`;
    }
  }

  return {
    name,
    priceLabel: price != null ? `${price}` : "—",
    originalPriceLabel: originalPrice != null ? `${originalPrice}` : "",
    thumbUrl,
    quantityLabel: quantity != null ? String(quantity) : "—",
    warrantyLabel,
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts({
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
              "تعذر تحميل المنتجات. تحققي من تسجيل الدخول والشبكة.",
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
  }, [page, activeSearch]);

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

  const products = useMemo(() => normalizeProductListFromApi(raw), [raw]);

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
        <Link to={appHref("products/create")} className="products-page__add-btn">
          + إضافة منتج
        </Link>
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

      {loading ? (
        <p className="products-page__state">جاري تحميل المنتجات...</p>
      ) : error ? (
        <p className="products-page__state products-page__state--error">{error}</p>
      ) : products.length === 0 ? (
        <p className="products-page__state">لا توجد منتجات. يمكنك إضافة منتج جديد.</p>
      ) : (
        <>
          <div className="products-grid">
            {products.map((item, index) => {
              const id = item?.id ?? item?._id ?? item?.sku ?? index;
              const { name, priceLabel, originalPriceLabel, thumbUrl, warrantyLabel } =
                getProductDisplayFields(item);
              const editId = item?.id ?? item?._id;
              const displayName = String(name ?? "—").trim() || "—";
              return (
                <article key={String(id)} className="product-card">
                  <header className="product-card__ribbon" title={displayName}>
                    <h2 className="product-card__ribbon-title">{displayName}</h2>
                  </header>

                  <div className="product-card__image-wrap">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={displayName} className="product-card__image" />
                    ) : (
                      <span className="product-card__image-placeholder">لا توجد صورة</span>
                    )}
                  </div>

                  <div className="product-card__body">
                    <div className="product-card__title-row">
                      <h3 className="product-card__title">{displayName}</h3>
                      {warrantyLabel ? (
                        <span className="product-card__warranty">{warrantyLabel}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="product-card__price-bar">
                    <span className="product-card__price">
                      {priceLabel !== "—" ? `${priceLabel} ج` : "—"}
                      {originalPriceLabel ? (
                        <span className="product-card__price-original">
                          {originalPriceLabel} ج
                        </span>
                      ) : null}
                    </span>
                    {editId != null ? (
                      <Link
                        to={appHref(`products/${encodeURIComponent(String(editId))}/edit`)}
                        className="product-card__edit-link"
                      >
                        تعديل
                      </Link>
                    ) : null}
                  </div>

                  {/* <div className="product-card__actions">
                    {editId != null ? (
                      <Link
                        to={appHref(`products/${encodeURIComponent(String(editId))}/edit`)}
                        className="product-card__action-btn product-card__action-btn--edit"
                      >
                        ✏️ تعديل
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="product-card__action-btn product-card__action-btn--edit"
                        disabled
                        title="لا يوجد معرّف للتعديل"
                      >
                        ✏️ تعديل
                      </button>
                    )}
                    <button
                      type="button"
                      className="product-card__action-btn product-card__action-btn--delete"
                      onClick={() => alert(`حذف المنتج: ${name}`)}
                    >
                      🗑 حذف
                    </button>
                  </div> */}
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
