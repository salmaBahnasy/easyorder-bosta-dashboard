import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getEmployees, getOrders } from "../../api/ordersApi";
import OrdersTable from "../../components/OrdersTable";
import { parseOrdersResponse } from "../../utils/ordersResponse";
import "./OrdersPage.css";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    employee: "",
    from: "",
    to: "",
  });
  const navigate = useNavigate();
  const location = useLocation();

  const statusOptions = [
    { value: "", label: "كل الحالات" },
    { value: "new", label: "جديد" },
    { value: "canceled", label: "لاغي" },
    { value: "no_replay", label: "لا يرد" },
    { value: "follow up", label: "متابعة" },
    { value: "repeater", label: "مكرر" },
    { value: "Confirmed", label: "تم التأكيد" },
    { value: "Shipped", label: "تم الشحن" },
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
      new: ["جديد"],
    };

    const selectedAliases = aliases[selected] ?? [];
    return selectedAliases.includes(orderStatus);
  }

  async function fetchOrders(pageNumber = page, nextFilters = filters) {
    try {
      setLoading(true);

      const result = await getOrders({
        page: pageNumber,
        limit,
        status: nextFilters.status || undefined,
        employeeId: nextFilters.employee || undefined,
        from: nextFilters.from || undefined,
        to: nextFilters.to || undefined,
      });

      const { list, page, total, totalPages } = parseOrdersResponse(result);
      setOrders(list);
      setPage(page ?? pageNumber);
      setTotal(total ?? list.length);
      setTotalPages(totalPages ?? 1);
    } catch (error) {
      console.log(error);
      alert("حصل خطأ أثناء تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders(1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        const result = await getEmployees();
        const list = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.employees)
            ? result.employees
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

  function handleFilterChange(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function applyFilters() {
    fetchOrders(1, filters);
  }

  function clearFilters() {
    const clearedFilters = { status: "", employee: "", from: "", to: "" };
    setFilters(clearedFilters);
    fetchOrders(1, clearedFilters);
  }

  function handleViewDetails(order) {
    navigate("/orders/payload-details", {
      state: { returnTo: location.pathname, order },
    });
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

  const filteredOrders = useMemo(() => orders, [orders]);

  const hasLocalFilters = Boolean(filters.status || filters.employee);

  const summaryStats = useMemo(() => {
    const normalized = filteredOrders.map((order) => normalizeStatus(getOrderStatus(order)));
    const confirmed = normalized.filter((status) =>
      ["confirmed", "تم التأكيد"].includes(status)
    ).length;
    const cancelled = normalized.filter((status) =>
      ["canceled", "cancelled", "لاغي"].includes(status)
    ).length;
    const noReply = normalized.filter((status) =>
      ["no replay", "no reply", "لا يرد"].includes(status)
    ).length;

    return {
      total: hasLocalFilters ? filteredOrders.length : total,
      confirmed,
      cancelled,
      noReply,
    };
  }, [filteredOrders, hasLocalFilters, total]);

  return (
    <div className="orders-page">
      <section className="orders-page__header">
        <div>
          <h1>إدارة الطلبات</h1>
          <p>متابعة الطلبات وتصفيتها حسب الحالة أو الفترة الزمنية.</p>
        </div>
        <div className="orders-page__header-actions">
          <button
            onClick={() => navigate("/orders/create")}
            className="orders-page__btn orders-page__btn--primary"
            type="button"
          >
            + إنشاء طلب
          </button>
          <button
            onClick={() => fetchOrders(1)}
            disabled={loading}
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

    
      <section className="orders-page__stats">
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
      </section>

      {loading ? (
        <p className="orders-page__loading">جاري تحميل الطلبات...</p>
      ) : (
        <>
          <OrdersTable orders={filteredOrders} onViewDetails={handleViewDetails} />

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