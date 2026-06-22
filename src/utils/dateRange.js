/** Egypt (Cairo) offset for API date boundaries — matches backend expectation (+03:00). */
const EGYPT_OFFSET = "+03:00";

/**
 * Normalizes UI date input to `YYYY-MM-DD`, or returns empty string.
 */
export function normalizeDateInput(date) {
  const s = String(date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

/**
 * Single calendar day in Egypt local time → UTC ISO range for API `from` / `to`.
 *
 * @example buildEgyptDateRange("2026-05-23")
 * // { from: "2026-05-22T21:00:00.000Z", to: "2026-05-23T20:59:59.999Z" }
 */
export function buildEgyptDateRange(date) {
  const day = normalizeDateInput(date);
  if (!day) {
    return { from: undefined, to: undefined };
  }

  const start = new Date(`${day}T00:00:00${EGYPT_OFFSET}`);
  const end = new Date(`${day}T23:59:59.999${EGYPT_OFFSET}`);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

/**
 * Inclusive range between two calendar days (Egypt local).
 */
export function buildEgyptDateRangeFromTo(dateFrom, dateTo) {
  const fromDay = normalizeDateInput(dateFrom);
  const toDay = normalizeDateInput(dateTo);
  if (!fromDay || !toDay) return {};

  const start = buildEgyptDateRange(fromDay);
  const end = buildEgyptDateRange(toDay);

  return {
    from: start.from,
    to: end.to,
  };
}

/** Today's date as `YYYY-MM-DD` in Africa/Cairo. */
export function egyptTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(),
  );
}

/** Clamp inclusive calendar range so neither end is after today (Cairo). */
export function clampDateRangeToToday(dateFrom, dateTo) {
  const today = egyptTodayYmd();
  let from = normalizeDateInput(dateFrom);
  let to = normalizeDateInput(dateTo);
  if (!from && !to) return { dateFrom: from, dateTo: to };
  if (!from) from = to;
  if (!to) to = from;
  if (to > today) to = today;
  if (from > today) from = today;
  if (from > to) from = to;
  return { dateFrom: from, dateTo: to };
}

/** Drop chart points dated after today (Cairo). */
export function filterPointsUpToToday(points) {
  const today = egyptTodayYmd();
  return (Array.isArray(points) ? points : []).filter((p) => {
    const d = normalizeDateInput(p?.date);
    return d && d <= today;
  });
}

function addDaysToYmd(ymd, dayDelta) {
  const anchor = new Date(`${ymd}T12:00:00${EGYPT_OFFSET}`);
  anchor.setTime(anchor.getTime() + dayDelta * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    anchor,
  );
}

/**
 * Preset dashboard ranges in Egypt local time.
 * @param {"today"|"7d"|"month"|string} preset
 */
export function buildEgyptPresetDateRange(preset) {
  const key = String(preset ?? "").trim();
  const today = egyptTodayYmd();

  if (key === "today") {
    return buildEgyptDateRange(today);
  }

  if (key === "7d") {
    const fromDay = addDaysToYmd(today, -6);
    return buildEgyptDateRangeFromTo(fromDay, today);
  }

  if (key === "month") {
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    return buildEgyptDateRangeFromTo(firstOfMonth, today);
  }

  return {};
}

/**
 * Dashboard / stats query builder: custom range or preset.
 */
export function computeEgyptDateRangeParams({ dateRange, dateFrom, dateTo } = {}) {
  if (dateFrom && dateTo) {
    const capped = clampDateRangeToToday(dateFrom, dateTo);
    return buildEgyptDateRangeFromTo(capped.dateFrom, capped.dateTo);
  }
  return buildEgyptPresetDateRange(dateRange);
}

/**
 * Converts a single date field for API query params.
 * `YYYY-MM-DD` → Egypt-local day boundary in UTC; full ISO strings pass through.
 */
export function toApiQueryDate(value, endOfDay = false) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const range = buildEgyptDateRange(s);
    return endOfDay ? range.to : range.from;
  }

  return s;
}

/**
 * Ensures `from` / `to` on an object are API-ready (mutates copy).
 */
export function normalizeApiDateParams(params = {}) {
  const out = { ...params };
  if (out.from != null && String(out.from).trim() !== "") {
    out.from = toApiQueryDate(out.from, false);
  }
  if (out.to != null && String(out.to).trim() !== "") {
    out.to = toApiQueryDate(out.to, true);
  }
  return out;
}
