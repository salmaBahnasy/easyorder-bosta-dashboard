import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAddedOrder,
  getAddedOrders,
  getEmployees,
  getOrderByReference,
  getProducts,
  resolveEmployeeOrderFilterParams,
} from "../../api/ordersApi";
import {
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";
import CartProductSelect from "../../components/CartProductSelect";
import { useProductCatalog } from "../../hooks/useProductCatalog";
import {
  productOptionId,
  productToCartFields,
} from "./cartCatalogHelpers";
import {
  buildAddedOrderPayload,
  computeAddedProductsTotal,
  createEmptyAddedProduct,
  mapAddedOrderRecordToRow,
  parseAddedOrdersResponse,
  validateAddedOrderRow,
} from "../../utils/addedOrders";
import {
  additionalOrderRowStatusLabel,
  getAdditionalOrderRowTone,
  parseOrderFromReferenceResponse,
} from "../../utils/additionalOrderRow";
import { orderCustomer, orderPhone } from "../../utils/orderDisplay";
import "./AdditionalOrdersPage.css";

function pickText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "—") return text;
  }
  return "";
}

function buildDraftRowFromOrder(order) {
  const ref =
    order?.order_reference ??
    order?.orderReference ??
    order?.short_id ??
    order?.shortId ??
    "";

  return {
    key: `draft-${ref}-${Date.now()}`,
    id: null,
    saved: false,
    orderReference: String(ref),
    order,
    customerName: pickText(orderCustomer(order), order?.full_name, order?.firstName),
    phone: pickText(orderPhone(order), order?.phone, order?.mobile),
    products: [createEmptyAddedProduct()],
    totalCost: 0,
  };
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function addedProductLinePrice(item) {
  const raw = item?.price ?? item?.cost ?? "";
  return raw === "" || raw == null ? "" : raw;
}

function AddedProductsCell({
  row,
  editable,
  catalogProducts,
  catalogLoading,
  onCatalogSearchChange,
  onCatalogSelect,
  onUpdateProduct,
  onAddProduct,
  onRemoveProduct,
}) {
  if (!editable) {
    return (
      <ul className="additional-orders-table__product-list">
        {(row.products ?? []).map((item) => (
          <li key={item.key}>
            <strong>{item.name || "—"}</strong>
            <span>
              ×{item.quantity} — {formatMoney(addedProductLinePrice(item))} ج
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="additional-orders-table__products-editor">
      {(row.products ?? []).map((item, index) => (
        <div key={item.key} className="additional-orders-table__product-line">
          <div className="additional-orders-table__product-select">
            <CartProductSelect
              row={item}
              catalogProducts={catalogProducts}
              catalogLoading={catalogLoading}
              onSearchChange={onCatalogSearchChange}
              onSelect={(optionId) =>
                onCatalogSelect(row.key, item.key, optionId)
              }
            />
          </div>
          <input
            className="additional-orders-page__input additional-orders-table__product-qty"
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) =>
              onUpdateProduct(row.key, item.key, {
                quantity: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
          <input
            className="additional-orders-page__input additional-orders-table__product-cost"
            type="number"
            min="0"
            step="0.01"
            value={addedProductLinePrice(item)}
            placeholder="السعر"
            onChange={(e) => {
              const raw = e.target.value;
              onUpdateProduct(row.key, item.key, {
                price: raw === "" ? "" : Number(raw),
              });
            }}
          />
          {(row.products?.length ?? 0) > 1 ? (
            <button
              type="button"
              className="additional-orders-table__product-remove"
              onClick={() => onRemoveProduct(row.key, item.key)}
              title="حذف المنتج"
            >
              ×
            </button>
          ) : null}
          {index === (row.products?.length ?? 0) - 1 ? (
            <button
              type="button"
              className="additional-orders-table__product-add"
              onClick={() => onAddProduct(row.key)}
              title="إضافة منتج"
              disabled={catalogLoading}
            >
              +
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function AdditionalOrdersPage() {
  const [referenceInput, setReferenceInput] = useState("");
  const [rows, setRows] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const limit = 50;

  const catalogCartItems = useMemo(
    () => draftRows.flatMap((row) => row.products ?? []),
    [draftRows],
  );
  const { catalogProducts, catalogLoading, onCatalogSearchChange } =
    useProductCatalog(catalogCartItems);

  const employeeOptions = useMemo(() => {
    const mapped = employees
      .map((employee) => ({
        id: employee?.id ?? employee?._id ?? employee?.employeeId ?? "",
        name: String(employee?.name ?? employee?.full_name ?? "").trim(),
      }))
      .filter((employee) => employee.id && employee.name);

    const dedup = new Map();
    mapped.forEach((employee) => {
      if (!dedup.has(employee.id)) dedup.set(employee.id, employee);
    });

    return Array.from(dedup.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ar"),
    );
  }, [employees]);

  const productFilterOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const item of products) {
      const { name, sku } = getProductListLabel(item);
      const value = String(name ?? "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const label = sku ? `${name} — ${sku}` : name;
      rows.push({ value, label });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return rows;
  }, [products]);

  const loadAddedOrders = useCallback(
    async (pageNumber = 1) => {
      try {
        setListLoading(true);
        setError("");
        const payload = await getAddedOrders({
          page: pageNumber,
          limit,
          ...resolveEmployeeOrderFilterParams(employees, employeeFilter),
          product: String(productFilter ?? "").trim() || undefined,
        });
        const { list, page, total, totalPages } =
          parseAddedOrdersResponse(payload);
        setRows(list.map((record, index) => mapAddedOrderRecordToRow(record, index)));
        setPage(page);
        setTotal(total);
        setTotalPages(totalPages);
      } catch (err) {
        console.log(err);
        setError(err?.response?.data?.message ?? "تعذر تحميل الطلبات المضافة");
        setRows([]);
      } finally {
        setListLoading(false);
      }
    },
    [employees, employeeFilter, productFilter],
  );

  useEffect(() => {
    loadAddedOrders(1);
  }, [loadAddedOrders]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        const result = await getEmployees();
        const list = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.employees)
            ? result.employees
            : Array.isArray(result)
              ? result
              : [];
        if (!cancelled) setEmployees(list);
      } catch (err) {
        console.log(err);
        if (!cancelled) setEmployees([]);
      }
    }

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAllProducts() {
      const pageSize = 100;
      const aggregated = [];
      try {
        setProductsLoading(true);
        let pageNum = 1;
        while (!cancelled) {
          const data = await getProducts({ page: pageNum, limit: pageSize });
          const list = normalizeProductList(data);
          aggregated.push(...list);
          const totalPages =
            data?.totalPages ?? data?.pagination?.totalPages ?? null;
          const done =
            list.length === 0 ||
            list.length < pageSize ||
            (totalPages != null && pageNum >= totalPages);
          if (done) break;
          pageNum += 1;
          if (pageNum > 200) break;
        }
        if (!cancelled) setProducts(aggregated);
      } catch (err) {
        console.log(err);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadAllProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleEmployeeFilterChange(value) {
    setEmployeeFilter(value);
  }

  function handleProductFilterChange(value) {
    setProductFilter(value);
  }

  function updateDraftRow(rowKey, patch) {
    setDraftRows((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  }

  function updateDraftProduct(rowKey, productKey, patch) {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const products = (row.products ?? []).map((item) =>
          item.key === productKey ? { ...item, ...patch } : item,
        );
        return {
          ...row,
          products,
          totalCost: computeAddedProductsTotal(products),
        };
      }),
    );
  }

  function addDraftProduct(rowKey) {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? { ...row, products: [...(row.products ?? []), createEmptyAddedProduct()] }
          : row,
      ),
    );
  }

  function removeDraftProduct(rowKey, productKey) {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const next = (row.products ?? []).filter((item) => item.key !== productKey);
        const products = next.length > 0 ? next : [createEmptyAddedProduct()];
        return {
          ...row,
          products,
          totalCost: computeAddedProductsTotal(products),
        };
      }),
    );
  }

  function handleProductCatalogSelect(rowKey, productKey, optionId) {
    if (!optionId) {
      updateDraftProduct(rowKey, productKey, {
        sku: "",
        name: "",
        price: "",
        catalogProductId: null,
        catalogProductKey: "",
        catalogOptionId: "",
      });
      return;
    }
    const idx = catalogProducts.findIndex(
      (p, i) => productOptionId(p, i) === optionId,
    );
    if (idx === -1) return;
    const fields = productToCartFields(catalogProducts[idx]);
    updateDraftProduct(rowKey, productKey, {
      ...fields,
      price: "",
      catalogOptionId: optionId,
    });
  }

  async function handleSearch(event) {
    event?.preventDefault?.();
    const ref = String(referenceInput ?? "").trim();
    if (!ref) {
      setError("أدخلي رقم مرجع الطلب");
      return;
    }

    setError("");
    setSuccessMessage("");
    setSearchLoading(true);
    try {
      const payload = await getOrderByReference(ref, { presented: true });
      const order = parseOrderFromReferenceResponse(payload);
      if (!order || typeof order !== "object") {
        setError("لم يُعثر على بيانات لهذا المرجع");
        return;
      }

      const nextRow = buildDraftRowFromOrder(order);
      setDraftRows((prev) => {
        const idx = prev.findIndex(
          (r) => r.orderReference === nextRow.orderReference,
        );
        if (idx === -1) return [nextRow, ...prev];
        const copy = [...prev];
        copy[idx] = { ...nextRow, key: prev[idx].key };
        return copy;
      });
      setReferenceInput("");
    } catch (err) {
      console.log(err);
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "تعذر جلب الطلب بهذا المرجع",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSaveRow(row) {
    const validationErrors = validateAddedOrderRow(row);
    if (validationErrors.length > 0) {
      setError(validationErrors.join("\n"));
      return;
    }

    setError("");
    setSuccessMessage("");
    setSavingKey(row.key);
    try {
      await createAddedOrder(buildAddedOrderPayload(row));
      setSuccessMessage("تم تسجيل الطلب المضاف بنجاح");
      if (!row.saved) {
        setDraftRows((prev) => prev.filter((r) => r.key !== row.key));
      }
      await loadAddedOrders(page);
    } catch (err) {
      console.log(err);
      setError(err?.response?.data?.message ?? "تعذر تسجيل الطلب المضاف");
    } finally {
      setSavingKey("");
    }
  }

  function handleRemoveDraft(rowKey) {
    setDraftRows((prev) => prev.filter((row) => row.key !== rowKey));
  }

  const displayRows = [...draftRows, ...rows];
  const isBusy = listLoading || searchLoading;

  function renderTableRow(row, { allowRemoveDraft = false }) {
    const tone = getAdditionalOrderRowTone(row.order);
    const isSaving = savingKey === row.key;
    const total =
      row.saved && row.totalCost
        ? row.totalCost
        : computeAddedProductsTotal(row.products);

    return (
      <tr
        key={row.key}
        className={`additional-orders-table__row additional-orders-table__row--${tone}`}
      >
        <td>
          <strong>{row.orderReference}</strong>
          {!row.saved ? (
            <span className="additional-orders-page__draft-tag">مسودة</span>
          ) : null}
        </td>
        <td>
          <input
            className="additional-orders-page__input"
            value={row.customerName}
            disabled={row.saved}
            onChange={(e) =>
              row.saved
                ? undefined
                : updateDraftRow(row.key, { customerName: e.target.value })
            }
          />
        </td>
        <td>
          <input
            className="additional-orders-page__input"
            type="tel"
            inputMode="tel"
            value={row.phone}
            disabled={row.saved}
            onChange={(e) =>
              row.saved ? undefined : updateDraftRow(row.key, { phone: e.target.value })
            }
          />
        </td>
        <td className="additional-orders-table__products-cell">
          <AddedProductsCell
            row={row}
            editable={!row.saved}
            catalogProducts={catalogProducts}
            catalogLoading={catalogLoading}
            onCatalogSearchChange={onCatalogSearchChange}
            onCatalogSelect={handleProductCatalogSelect}
            onUpdateProduct={updateDraftProduct}
            onAddProduct={addDraftProduct}
            onRemoveProduct={removeDraftProduct}
          />
        </td>
        <td className="additional-orders-table__total-cell">
          <strong>{formatMoney(total)} ج</strong>
        </td>
        <td>
          <span
            className={`additional-orders-page__status-badge additional-orders-page__status-badge--${tone}`}
          >
            {additionalOrderRowStatusLabel(row.order)}
          </span>
        </td>
        <td className="additional-orders-table__actions-cell">
          {!row.saved ? (
            <button
              type="button"
              className="additional-orders-page__btn additional-orders-page__btn--primary"
              disabled={isSaving}
              onClick={() => handleSaveRow(row)}
            >
              {isSaving ? "..." : "تسجيل"}
            </button>
          ) : null}
          {allowRemoveDraft ? (
            <button
              type="button"
              className="additional-orders-page__btn additional-orders-page__btn--outline"
              onClick={() => handleRemoveDraft(row.key)}
            >
              إلغاء
            </button>
          ) : null}
        </td>
      </tr>
    );
  }

  return (
    <div className="additional-orders-page">
      <header className="additional-orders-page__header">
        <div>
          <h1>الطلبات الإضافية</h1>
          <p>
            ابحثي برقم المرجع، أضيفي منتجات متعددة في نفس الصف، ثم اضغطي «تسجيل».
          </p>
        </div>
        <button
          type="button"
          className="additional-orders-page__btn additional-orders-page__btn--outline"
          disabled={listLoading}
          onClick={() => loadAddedOrders(page)}
        >
          تحديث القائمة
        </button>
      </header>

      <section className="additional-orders-page__filters-card">
        <label className="additional-orders-page__filter-field">
          الموظف
          <select
            className="additional-orders-page__input"
            value={employeeFilter}
            onChange={(e) => handleEmployeeFilterChange(e.target.value)}
            disabled={listLoading}
          >
            <option value="">كل الموظفين</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>

        <label className="additional-orders-page__filter-field">
          المنتج
          <select
            className="additional-orders-page__input"
            value={productFilter}
            onChange={(e) => handleProductFilterChange(e.target.value)}
            disabled={listLoading || productsLoading}
          >
            <option value="">
              {productsLoading ? "جاري تحميل المنتجات..." : "كل المنتجات"}
            </option>
            {productFilterOptions.map((product) => (
              <option key={product.value} value={product.value}>
                {product.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <form className="additional-orders-page__search-card" onSubmit={handleSearch}>
        <label className="additional-orders-page__search-field">
          رقم مرجع الطلب 
          <input
            className="additional-orders-page__input"
            type="text"
            inputMode="numeric"
            placeholder="مثال: 1001"
            value={referenceInput}
            onChange={(e) => setReferenceInput(e.target.value)}
            disabled={isBusy}
          />
        </label>
        <button
          type="submit"
          className="additional-orders-page__btn additional-orders-page__btn--primary"
          disabled={isBusy}
        >
          {searchLoading ? "جاري البحث..." : "بحث بالمرجع"}
        </button>
      </form>

      {error ? <p className="additional-orders-page__error">{error}</p> : null}
      {successMessage ? (
        <p className="additional-orders-page__success">{successMessage}</p>
      ) : null}

      {listLoading && displayRows.length === 0 ? (
        <p className="additional-orders-page__empty">جاري تحميل الطلبات المضافة...</p>
      ) : null}

      {!listLoading && displayRows.length === 0 ? (
        <p className="additional-orders-page__empty">
          لا توجد طلبات مضافة — ابحثي برقم المرجع لإضافة صف جديد.
        </p>
      ) : null}

      {displayRows.length > 0 ? (
        <>
          <div className="additional-orders-page__list-meta">
            <span>إجمالي المسجّل: {total}</span>
            <span>
              صفحة {page} من {totalPages}
            </span>
          </div>

          <div className="additional-orders-table-wrap">
            <table className="additional-orders-table">
              <thead>
                <tr>
                  <th>المرجع</th>
                  <th>اسم العميل</th>
                  <th>رقم التليفون</th>
                  <th>المنتجات المضافة</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row) => renderTableRow(row, { allowRemoveDraft: true }))}
                {rows.map((row) => renderTableRow(row))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="additional-orders-page__pagination">
              <button
                type="button"
                className="additional-orders-page__btn additional-orders-page__btn--outline"
                disabled={page <= 1 || listLoading}
                onClick={() => loadAddedOrders(page - 1)}
              >
                السابق
              </button>
              <span>
                صفحة {page} من {totalPages}
              </span>
              <button
                type="button"
                className="additional-orders-page__btn additional-orders-page__btn--outline"
                disabled={page >= totalPages || listLoading}
                onClick={() => loadAddedOrders(page + 1)}
              >
                التالي
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
