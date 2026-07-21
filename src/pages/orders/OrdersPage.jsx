import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  downloadOrdersExportFile,
  exportOrders,
  getEmployees,
  getOrders,
  getProducts,
  refreshCustomerStatus,
  resolveEmployeeOrderFilterParams,
} from "../../api/ordersApi";
import { appHref } from "../../utils/auth";
import OrdersTable from "../../components/OrdersTable";
import { formatApiErrorMessage } from "../../utils/apiErrors";
import { orderRowKey } from "../../utils/orderDisplay";
import {
  applyCustomerStatusToOrder,
  canRefreshCustomerStatus,
  isPendingCustomerStatus,
  pickCustomerStatusFromRefreshResult,
  resolveCustomerStatusRefreshOrderId,
} from "../../utils/customerStatusRefresh";
import { parseOrdersResponse } from "../../utils/ordersResponse";
import {
  getProductFilterId,
  getProductListLabel,
  normalizeProductList,
} from "../../utils/ordersFilterProductOptions";
import {
  clearOrdersListState,
  getDefaultOrdersFilters,
  resolveOrdersListBootState,
  writeOrdersListState,
} from "../../utils/ordersListState";
import "./OrdersPage.css";

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bootStateRef = useRef(null);
  if (bootStateRef.current === null) {
    bootStateRef.current = resolveOrdersListBootState(location.state);
  }

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(() => bootStateRef.current.page);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filters, setFilters] = useState(() => bootStateRef.current.filters);
  const [highlightOrderId, setHighlightOrderId] = useState(
    () => bootStateRef.current.focusedOrderId ?? null,
  );
  const [refreshingCustomerStatusId, setRefreshingCustomerStatusId] =
    useState(null);
  const [pendingCustomerStatusPass, setPendingCustomerStatusPass] = useState(0);
  const customerStatusRefreshGenRef = useRef(0);
  const statusOptions = [
    { value: "", label: "كل الحالات" },
    { value: "new", label: "قيد المراجعة" },
    { value: "canceled", label: "لاغي" },
    { value: "no_replay", label: "لا يرد" },
    { value: "follow up", label: "متابعة" },
    { value: "repeater", label: "مكرر" },
    { value: "Confirmed", label: "تم التأكيد" },
    { value: "Shipped", label: "تم الشحن" },
  ];

  const orderSourceOptions = [
    { value: "", label: "كل المصادر" },
    { value: "store", label: "متجر" },
    { value: "messenger", label: "ماسنجر" },
    { value: "whatsapp", label: "واتساب" },
    { value: "lost_order", label: "طلب ضائع" },
    { value: "old_customer", label: "عميل قديم" },
  ];

  const orderTypeOptions = [
    { value: "", label: "كل الأنواع" },
    { value: "new", label: "أوردر جديد" },
    { value: "replacement", label: "استبدال" },
    { value: "return", label: "مرتجع" },
  ];

  const shippingStatusOptions = [
    { value: "", label: "كل حالات الشحن" },
    { value: "in_progress", label: "قيد التنفيذ" },
    { value: "delivered", label: "تم التسليم" },
    { value: "failed", label: "فشل" },
  ];

  const customerStatusOptions = [
    { value: "", label: "كل الحالات" },
    { value: "Confirmed", label: "تم التأكيد" },
    { value: "canceled", label: "لاغي" },
    { value: "pending", label: "pending" },
    { value: "failed", label: "failed" },
  ];

  function normalizeStatus(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ");
  }

  function getOrderStatus(order) {
    return (
      order?.orderStatus ??
      order?.order_status ??
      order?.status ??
      order?.["Order Status"] ??
      ""
    );
  }

  function getOrderEmployee(order) {
    return (
      order?.employeeName ??
      order?.employee_name ??
      order?.employee?.name ??
      order?.employee ??
      order?.assignedTo ??
      order?.assigned_to ??
      order?.salesName ??
      order?.sales_name ??
      order?.createdByName ??
      order?.created_by_name ??
      ""
    );
  }

  function matchesSelectedStatus(order, selectedStatus) {
    if (!selectedStatus) return true;

    const selected = normalizeStatus(selectedStatus);
    const orderStatus = normalizeStatus(getOrderStatus(order));

    if (selected === orderStatus) return true;

    const aliases = {
      canceled: ["cancelled", "لاغي"],
      "no replay": ["no reply", "لا يرد"],
      "follow up": ["followup", "متابعة"],
      repeater: ["duplicate", "مكرر"],
      confirmed: ["تم التأكيد"],
      shipped: ["تم الشحن"],
      new: ["جديد", "قيد المراجعة"],
    };

    const selectedAliases = aliases[selected] ?? [];
    return selectedAliases.includes(orderStatus);
  }

  function buildOrdersApiFilters(nextFilters = filters) {
    const employeeId = String(nextFilters.employee ?? "").trim();
    return {
      status: nextFilters.status || undefined,
      ...resolveEmployeeOrderFilterParams(employees, employeeId),
      from: nextFilters.from || undefined,
      to: nextFilters.to || undefined,
      order_source: nextFilters.order_source || undefined,
      order_type: nextFilters.order_type || undefined,
      shipping_status: nextFilters.shipping_status || undefined,
      product_id: nextFilters.product_id?.trim() || undefined,
      phone: nextFilters.phone?.trim() || undefined,
      customer_name: nextFilters.customer_name?.trim() || undefined,
      customerStatus: nextFilters.customerStatus || undefined,
    };
  }

  async function fetchOrders(pageNumber = page, nextFilters = filters) {
    try {
      setLoading(true);

      const result = await getOrders({
        page: pageNumber,
        limit,
        ...buildOrdersApiFilters(nextFilters),
      });

      const { list, page, total, totalPages } = parseOrdersResponse(result, {
        limit,
      });
      const resolvedPage = page ?? pageNumber;
      setOrders(list);
      setPage(resolvedPage);
      setTotal(total ?? list.length);
      setTotalPages(totalPages ?? 1);
      writeOrdersListState({ filters: nextFilters, page: resolvedPage });
      setPendingCustomerStatusPass((n) => n + 1);
    } catch (error) {
      console.log(error);
      alert("حصل خطأ أثناء تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (bootStateRef.current.fromDetails) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    const boot = bootStateRef.current;
    fetchOrders(boot.page, boot.filters);
  }, []);

  useEffect(() => {
    if (!highlightOrderId || loading) return undefined;
    const timer = window.setTimeout(() => setHighlightOrderId(null), 5000);
    return () => window.clearTimeout(timer);
    // Do not depend on `orders` — background status patches were resetting the timer
    // and keeping the highlight (and scroll target) alive indefinitely.
  }, [highlightOrderId, loading]);

  useEffect(() => {
    if (loading || pendingCustomerStatusPass === 0) return undefined;
    if (!Array.isArray(orders) || orders.length === 0) return undefined;

    const ordersToRefresh = orders
      .map((order, index) => ({
        order,
        index,
        rowKey: orderRowKey(order, index),
      }))
      .filter(({ order }) => canRefreshCustomerStatus(order));

    if (ordersToRefresh.length === 0) return undefined;

    const gen = customerStatusRefreshGenRef.current + 1;
    customerStatusRefreshGenRef.current = gen;
    let cancelled = false;

    async function refreshCustomerStatusesInBackground() {
      for (const entry of ordersToRefresh) {
        if (cancelled || customerStatusRefreshGenRef.current !== gen) return;

        const orderId = String(
          resolveCustomerStatusRefreshOrderId(entry.order) ?? "",
        ).trim();
        if (!orderId) continue;

        try {
          if (isPendingCustomerStatus(entry.order)) {
            setRefreshingCustomerStatusId(entry.rowKey);
          }
          const result = await refreshCustomerStatus(orderId);
          if (cancelled || customerStatusRefreshGenRef.current !== gen) return;
          if (result?.success === false) continue;

          const nextStatus = pickCustomerStatusFromRefreshResult(result);
          if (!nextStatus) continue;

          setOrders((prev) =>
            prev.map((item, index) => {
              if (orderRowKey(item, index) !== entry.rowKey) return item;
              return applyCustomerStatusToOrder(item, nextStatus);
            }),
          );
        } catch (error) {
          console.error(
            "[refresh-customer-status:background]",
            error?.response?.data ?? error,
          );
        } finally {
          if (!cancelled && customerStatusRefreshGenRef.current === gen) {
            setRefreshingCustomerStatusId((current) =>
              current === entry.rowKey ? null : current,
            );
          }
        }
      }

      if (!cancelled && customerStatusRefreshGenRef.current === gen) {
        setRefreshingCustomerStatusId(null);
      }
    }

    refreshCustomerStatusesInBackground();

    return () => {
      cancelled = true;
      customerStatusRefreshGenRef.current += 1;
    };
    // Only re-run when a fresh list is fetched, not on each status patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingCustomerStatusPass]);

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

        if (!cancelled) {
          setEmployees(list);
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setEmployees([]);
        }
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
      const limit = 100;
      const aggregated = [];
      try {
        setProductsLoading(true);
        let page = 1;
        while (!cancelled) {
          const data = await getProducts({ page, limit });
          const list = normalizeProductList(data);
          aggregated.push(...list);
          const totalPages =
            data?.totalPages ?? data?.pagination?.totalPages ?? null;
          const done =
            list.length === 0 ||
            list.length < limit ||
            (totalPages != null && page >= totalPages);
          if (done) break;
          page += 1;
          if (page > 200) break;
        }
        if (!cancelled) {
          setProducts(aggregated);
        }
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    }

    loadAllProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFilterChange(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function applyFilters() {
    fetchOrders(1, filters);
  }

  async function handleExportOrders() {
    try {
      setExporting(true);
      const result = await exportOrders(buildOrdersApiFilters());
      downloadOrdersExportFile(result);

      const rows = result.rows != null ? Number(result.rows) : null;
      const totalMatched = result.total != null ? Number(result.total) : null;
      let message = "تم تنزيل ملف الطلبات بنجاح";
      if (rows != null && !Number.isNaN(rows)) {
        message = `تم تنزيل ${rows.toLocaleString("ar-EG")} صف في ملف Excel`;
      }
      if (result.truncated) {
        const totalText =
          totalMatched != null && !Number.isNaN(totalMatched)
            ? ` من أصل ${totalMatched.toLocaleString("ar-EG")}`
            : "";
        message += `\nتم اقتصار الملف على الحد الأقصى للتصدير${totalText}`;
      }
      alert(message);
    } catch (error) {
      console.log(error);
      alert(error?.message ?? "تعذر تصدير الطلبات");
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    const clearedFilters = getDefaultOrdersFilters();
    setFilters(clearedFilters);
    clearOrdersListState();
    fetchOrders(1, clearedFilters);
  }

  function handleViewDetails(order, rowIndex) {
    const focusedOrderId = orderRowKey(order, rowIndex);
    const ordersListState = { filters, page, focusedOrderId };
    writeOrdersListState(ordersListState);
    navigate(appHref("orders/payload-details"), {
      state: { returnTo: location.pathname, order, ordersListState },
    });
  }

  function handleCopyCustomer(order) {
    const ordersListState = { filters, page };
    writeOrdersListState(ordersListState);
    navigate(appHref("orders/create"), {
      state: { copyFromOrder: order, ordersListState },
    });
  }

  async function handleRefreshCustomerStatus(order, rowIndex) {
    if (!canRefreshCustomerStatus(order)) {
      return;
    }
    const orderId = String(
      resolveCustomerStatusRefreshOrderId(order) ?? "",
    ).trim();
    if (!orderId) {
      alert("لا يوجد رقم طلب صالح لتحديث حالة EasyConfirm");
      return;
    }

    const rowKey = orderRowKey(order, rowIndex);
    const showLoading = isPendingCustomerStatus(order);
    try {
      if (showLoading) setRefreshingCustomerStatusId(rowKey);
      const result = await refreshCustomerStatus(orderId);
      if (result?.success === false) {
        throw new Error(result?.message || "تعذر تحديث حالة EasyConfirm");
      }

      const nextStatus = pickCustomerStatusFromRefreshResult(result);
      if (nextStatus) {
        setOrders((prev) =>
          prev.map((item, index) => {
            if (orderRowKey(item, index) !== rowKey) return item;
            return applyCustomerStatusToOrder(item, nextStatus);
          }),
        );
      }
    } catch (error) {
      console.error("[refresh-customer-status]", error?.response?.data ?? error);
      alert(formatApiErrorMessage(error, "تعذر تحديث حالة EasyConfirm"));
    } finally {
      if (showLoading) setRefreshingCustomerStatusId(null);
    }
  }

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

    return Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [employees]);

  const productOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const item of products) {
      const id = getProductFilterId(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const { name, sku } = getProductListLabel(item);
      const label = sku ? `${name} — ${sku}` : name;
      rows.push({ id, label });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return rows;
  }, [products]);

  const filteredOrders = useMemo(() => orders, [orders]);

  const summaryStats = useMemo(() => {
    const normalized = filteredOrders.map((order) =>
      normalizeStatus(getOrderStatus(order)),
    );
    const confirmed = normalized.filter((status) =>
      ["confirmed", "تم التأكيد"].includes(status),
    ).length;
    const cancelled = normalized.filter((status) =>
      ["canceled", "cancelled", "لاغي"].includes(status),
    ).length;
    const noReply = normalized.filter((status) =>
      ["no replay", "no reply", "لا يرد"].includes(status),
    ).length;

    return {
      total,
      confirmed,
      cancelled,
      noReply,
    };
  }, [filteredOrders, total]);

  return (
    <div className="orders-page">
      <section className="orders-page__header">
        <div>
          <h1>إدارة الطلبات</h1>
          <p>متابعة الطلبات وتصفيتها حسب الحالة أو الفترة الزمنية.</p>
        </div>
        <div className="orders-page__header-actions">
          <button
            onClick={() => navigate(appHref("orders/create"))}
            className="orders-page__btn orders-page__btn--primary"
            type="button"
          >
            + إنشاء طلب
          </button>
          <button
            onClick={handleExportOrders}
            disabled={loading || exporting}
            className="orders-page__btn orders-page__btn--export"
            type="button"
          >
            {exporting ? "جاري التصدير..." : "تصدير Excel"}
          </button>
          <button
            onClick={() => fetchOrders(1)}
            disabled={loading || exporting}
            className="orders-page__btn orders-page__btn--secondary"
            type="button"
          >
            تحديث
          </button>
        </div>
      </section>

      <section className="orders-page__filters-card1">
      <section className="orders-page__filters-card">

        <label className="orders-page__field">
          الحالة
          <select
            className="orders-page__input"
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value || "all-statuses"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          easyconfirm
          <select
            className="orders-page__input"
            value={filters.customerStatus}
            onChange={(e) => handleFilterChange("customerStatus", e.target.value)}
          >
            {customerStatusOptions.map((option) => (
              <option
                key={option.value || "all-customer-statuses"}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          الموظف
          <select
            className="orders-page__input"
            value={filters.employee}
            onChange={(e) => handleFilterChange("employee", e.target.value)}
          >
            <option value="">كل الموظفين</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          اسم العميل
          <input
            className="orders-page__input"
            type="search"
            autoComplete="off"
            placeholder="اسم العميل"
            value={filters.customer_name}
            onChange={(e) => handleFilterChange("customer_name", e.target.value)}
          />
        </label>

        <label className="orders-page__field">
          تليفون العميل
          <input
            className="orders-page__input"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="رقم التليفون"
            value={filters.phone}
            onChange={(e) => handleFilterChange("phone", e.target.value)}
          />
        </label>

        <label className="orders-page__field">
          من تاريخ
          <input
            className="orders-page__input"
            type="date"
            value={filters.from}
            onChange={(e) => handleFilterChange("from", e.target.value)}
          />
        </label>

        <label className="orders-page__field">
          إلى تاريخ
          <input
            className="orders-page__input"
            type="date"
            value={filters.to}
            onChange={(e) => handleFilterChange("to", e.target.value)}
          />
        </label>

        <label className="orders-page__field">
          مصدر الطلب
          <select
            className="orders-page__input"
            value={filters.order_source}
            onChange={(e) => handleFilterChange("order_source", e.target.value)}
          >
            {orderSourceOptions.map((option) => (
              <option key={option.value || "all-sources"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          نوع الطلب
          <select
            className="orders-page__input"
            value={filters.order_type}
            onChange={(e) => handleFilterChange("order_type", e.target.value)}
          >
            {orderTypeOptions.map((option) => (
              <option key={option.value || "all-types"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          حالة الشحن
          <select
            className="orders-page__input"
            value={filters.shipping_status}
            onChange={(e) => handleFilterChange("shipping_status", e.target.value)}
          >
            {shippingStatusOptions.map((option) => (
              <option key={option.value || "all-shipping"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="orders-page__field">
          المنتج
          <select
            className="orders-page__input"
            value={filters.product_id}
            onChange={(e) => handleFilterChange("product_id", e.target.value)}
            disabled={productsLoading}
          >
            <option value="">
              {productsLoading ? "جاري تحميل المنتجات..." : "كل المنتجات"}
            </option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        </section>
        <div className="orders-page__filter-actions">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="orders-page__btn orders-page__btn--primary"
            type="button"
          >
            تطبيق الفلتر
          </button>
          <button
            onClick={clearFilters}
            disabled={loading}
            className="orders-page__btn orders-page__btn--outline"
            type="button"
          >
            مسح الفلتر
          </button>
        </div>
      </section>

    
      {/* <section className="orders-page__stats">
        <article className="orders-page__stat-card">
          <span>إجمالي الطلبات</span>
          <strong>{summaryStats.total}</strong>
        </article>
        <article className="orders-page__stat-card">
          <span>الطلبات المؤكدة</span>
          <strong>{summaryStats.confirmed}</strong>
        </article>
        <article className="orders-page__stat-card">
          <span>الطلبات الملغية</span>
          <strong>{summaryStats.cancelled}</strong>
        </article>
        <article className="orders-page__stat-card">
          <span>لا يرد</span>
          <strong>{summaryStats.noReply}</strong>
        </article>
      </section> */}
        <article className="orders-page__stat-card">
          <span>إجمالي الطلبات</span>
          <strong>{summaryStats.total}</strong>
        </article>
      {loading ? (
        <p className="orders-page__loading">جاري تحميل الطلبات...</p>
      ) : (
        <>
          <OrdersTable
            orders={filteredOrders}
            highlightOrderId={highlightOrderId}
            onViewDetails={handleViewDetails}
            onCopyCustomer={handleCopyCustomer}
            onRefreshCustomerStatus={handleRefreshCustomerStatus}
            refreshingCustomerStatusId={refreshingCustomerStatusId}
          />

          <div className="orders-page__pagination">
            <button
              className="orders-page__btn orders-page__btn--outline"
              disabled={page <= 1}
              onClick={() => fetchOrders(page - 1)}
              type="button"
            >
              السابق
            </button>

            <span className="orders-page__pagination-label">
              صفحة {page} من {totalPages}
            </span>

            <button
              className="orders-page__btn orders-page__btn--outline"
              disabled={page >= totalPages}
              onClick={() => fetchOrders(page + 1)}
              type="button"
            >
              التالي
            </button>
          </div>
        </>
      )}

    </div>
  );
}
