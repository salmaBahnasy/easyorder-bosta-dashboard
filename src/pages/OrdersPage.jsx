import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getOrders } from "../api/ordersApi";
import OrdersTable from "../components/OrdersTable";
import { parseOrdersResponse } from "../utils/ordersResponse";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
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
    const clearedFilters = { status: "", from: "", to: "" };
    setFilters(clearedFilters);
    fetchOrders(1, clearedFilters);
  }

  function handleViewDetails(order) {
    navigate("/orders/payload-details", {
      state: { returnTo: location.pathname, order },
    });
  }

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesSelectedStatus(order, filters.status)),
    [orders, filters.status]
  );

  return (
    <div style={{ padding: 24, direction: "rtl", fontFamily: "Arial" }}>
      <h1>إدارة الطلبات</h1>

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => fetchOrders(1)} disabled={loading}>
          تحديث الطلبات
        </button>
        <button
          onClick={() => navigate("/orders/create")}
          style={{ marginRight: 8 }}
          type="button"
        >
          إنشاء طلب جديد
        </button>

        <span style={{ marginRight: 16 }}>
          إجمالي الطلبات: {filters.status ? filteredOrders.length : total}
        </span>
      </div>

      <div
        style={{
          marginBottom: 16,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          الحالة
          <select
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

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          من تاريخ
          <input
            type="date"
            value={filters.from}
            onChange={(e) => handleFilterChange("from", e.target.value)}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          إلى تاريخ
          <input
            type="date"
            value={filters.to}
            onChange={(e) => handleFilterChange("to", e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={applyFilters} disabled={loading}>
            تطبيق الفلتر
          </button>
          <button onClick={clearFilters} disabled={loading}>
            مسح الفلتر
          </button>
        </div>
      </div>

      {loading ? (
        <p>جاري تحميل الطلبات...</p>
      ) : (
        <>
        
          <OrdersTable orders={filteredOrders} onViewDetails={handleViewDetails} />

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              disabled={page <= 1}
              onClick={() => fetchOrders(page - 1)}
            >
              السابق
            </button>

            <span>
              صفحة {page} من {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => fetchOrders(page + 1)}
            >
              التالي
            </button>
          </div>
        </>
      )}
    </div>
  );
}