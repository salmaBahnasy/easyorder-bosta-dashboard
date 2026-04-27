import { useEffect, useMemo, useState } from "react";
import { getExternalProducts } from "../api/easyOrdersApi";

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
    <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>منتجات</h1>
     

      {!hasApiKey ? (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <strong>مفتاح Easy Orders غير مضبوط.</strong> أضيفي في ملف{" "}
          <code>.env</code>:
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#fff",
              borderRadius: 6,
              overflow: "auto",
              direction: "ltr",
              textAlign: "left",
            }}
          >
            VITE_EASY_ORDERS_API_KEY=your_api_key_here
          </pre>
          ثم أعدي تشغيل <code>npm run dev</code>. الترويسة المرسلة:{" "}
          <code>Api-Key</code>.
        </div>
      ) : null}

      {!hasApiKey ? null : loading ? (
        <p>جاري تحميل المنتجات...</p>
      ) : error ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : products.length === 0 ? (
        <p>لا توجد منتجات في الاستجابة.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              border="1"
              cellPadding="10"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
              }}
            >
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>الاسم</th>
                  <th>السعر</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item, index) => {
                  const id = item?.id ?? item?.sku ?? index;
                  const { name, priceLabel, thumbUrl, quantityLabel } =
                    getProductDisplayFields(item);
                  return (
                    <tr key={String(id)}>
                      <td style={{ width: 80 }}>
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt=""
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: "cover",
                              borderRadius: 6,
                              display: "block",
                            }}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{name}</td>
                      <td>{priceLabel !== "—" ? `${priceLabel} ج` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(totalPages != null && totalPages > 1) || page > 1 ? (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
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
