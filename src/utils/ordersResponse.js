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

function pickPositiveNumber(...candidates) {
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function resolvePaginationMeta({
  listLength,
  page,
  total,
  totalPages,
  limit,
  nested = {},
  root = {},
} = {}) {
  const pagination =
    (nested.pagination && typeof nested.pagination === "object"
      ? nested.pagination
      : null) ??
    (root.pagination && typeof root.pagination === "object"
      ? root.pagination
      : null) ??
    {};

  let resolvedPage = pickPositiveNumber(
    nested.page,
    root.page,
    pagination.page,
    page,
    1,
  );
  let resolvedTotalPages = pickPositiveNumber(
    nested.totalPages,
    nested.total_pages,
    root.totalPages,
    root.total_pages,
    pagination.totalPages,
    pagination.total_pages,
    totalPages,
    1,
  );
  let resolvedTotal = pickPositiveNumber(
    nested.total,
    nested.totalCount,
    nested.total_count,
    nested.count,
    root.total,
    root.totalCount,
    root.total_count,
    root.count,
    pagination.total,
    pagination.totalCount,
    pagination.total_count,
    pagination.count,
    total,
  );

  const pageSize = pickPositiveNumber(limit, nested.limit, root.limit, pagination.limit);
  if (
    pageSize &&
    resolvedTotalPages > 1 &&
    (resolvedTotal == null || resolvedTotal === listLength)
  ) {
    resolvedTotal =
      resolvedPage >= resolvedTotalPages
        ? (resolvedTotalPages - 1) * pageSize + listLength
        : (resolvedTotalPages - 1) * pageSize +
          (listLength > 0 ? listLength : pageSize);
  }

  return {
    page: resolvedPage || 1,
    total: resolvedTotal ?? listLength,
    totalPages: resolvedTotalPages || 1,
  };
}

/** يدعم شكل { data: { data: [...] } } وغيره من أشكال الاستجابة */
export function parseOrdersResponse(result, { limit } = {}) {
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
      ...resolvePaginationMeta({
        listLength: list.length,
        limit,
        root: result,
      }),
    };
  }

  if (topData && typeof topData === "object" && Array.isArray(topData.data)) {
    const list = mapList(topData.data);
    return {
      list,
      ...resolvePaginationMeta({
        listLength: list.length,
        limit,
        nested: topData,
        root: result,
      }),
    };
  }

  return { list: [], page: 1, total: 0, totalPages: 1 };
}
