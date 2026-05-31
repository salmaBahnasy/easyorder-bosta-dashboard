/**
 * استجابة GET /webhooks/easyorders/orders: كل عنصر { receivedAt, order }.
 * نفرد الطلب في صف واحد يفهمه الجدول و orderDisplay.
 */
function normalizeListRow(item) {
  if (
    item &&
    typeof item === "object" &&
    item.order &&
    typeof item.order === "object" &&
    item.order.id
  ) {
    return {
      ...item.order,
      webhookReceivedAt: item.receivedAt,
    };
  }
  return item;
}

function mapList(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeListRow);
}

/** يدعم شكل { data: { data: [...] } } وغيره من أشكال الاستجابة */
export function parseOrdersResponse(result) {
  if (result == null) {
    return { list: [], page: 1, total: 0, totalPages: 1 };
  }
  if (Array.isArray(result)) {
    const list = mapList(result);
    return {
      list,
      page: 1,
      total: list.length,
      totalPages: 1,
    };
  }

  const topData = result.data;
  if (Array.isArray(topData)) {
    const list = mapList(topData);
    return {
      list,
      page: result.page ?? 1,
      total: result.total ?? list.length,
      totalPages: result.totalPages ?? result.total_pages ?? 1,
    };
  }

  if (topData && typeof topData === "object" && Array.isArray(topData.data)) {
    const list = mapList(topData.data);
    return {
      list,
      page: topData.page ?? result.page ?? 1,
      total: topData.total ?? result.total ?? list.length,
      totalPages:
        topData.totalPages ??
        topData.total_pages ??
        result.totalPages ??
        result.total_pages ??
        1,
    };
  }

  return { list: [], page: 1, total: 0, totalPages: 1 };
}
