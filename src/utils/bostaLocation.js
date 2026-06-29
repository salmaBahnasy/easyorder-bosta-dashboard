import { arabicSearchMatches, normalizeArabicSearchText } from "./arabicSearch";

export function normalizeBostaCities(payload) {
  const list = payload?.data?.list;
  if (Array.isArray(list)) return list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function normalizeBostaDistricts(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function bostaCityLabel(city) {
  const label = String(city?.nameAr ?? "").trim();
  return label || "—";
}

export function bostaDistrictLabel(district) {
  const zoneAr = String(district?.zoneOtherName ?? "").trim();
  const zoneEn = String(district?.zoneName ?? "").trim();
  const districtAr = String(district?.districtOtherName ?? "").trim();
  const districtEn = String(district?.districtName ?? "").trim();

  if (zoneAr && districtAr) return `${zoneAr} — ${districtAr}`;
  if (zoneAr && districtEn) return `${zoneAr} — ${districtEn}`;
  if (zoneAr) return zoneAr;
  if (districtAr) return districtAr;
  if (districtEn) return districtEn;
  if (zoneEn) return zoneEn;
  return "—";
}

export function bostaCityId(city) {
  return String(city?._id ?? city?.id ?? "").trim();
}

export function bostaDistrictId(district) {
  return String(district?.districtId ?? district?._id ?? district?.id ?? "").trim();
}

export function bostaCitySearchText(city) {
  return [
    city?.nameAr,
    city?.alias,
    city?.name,
    city?.code,
  ]
    .filter(Boolean)
    .join(" ");
}

export function bostaDistrictSearchText(district) {
  return [
    district?.districtOtherName,
    district?.districtName,
    district?.zoneOtherName,
    district?.zoneName,
    district?.districtId,
  ]
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ");
}

/** محافظة الطلب من EasyOrder (مثلاً government: "الاقصر") */
export function getOrderGovernmentName(order) {
  return String(
    order?.government ?? order?.city ?? order?.governorate ?? order?.cityName ?? "",
  ).trim();
}

function governmentNamesMatch(a, b) {
  const left = normalizeArabicSearchText(a);
  const right = normalizeArabicSearchText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

/**
 * يطابق اسم محافظة من الطلب مع عنصر في قائمة Bosta (مثلاً "الاقصر" → "الأقصر").
 */
export function findBostaCityByName(cities, nameHint) {
  const hint = String(nameHint ?? "").trim();
  if (!hint || !Array.isArray(cities) || cities.length === 0) return null;

  const exact = cities.find((city) =>
    governmentNamesMatch(hint, bostaCityLabel(city)),
  );
  if (exact) return exact;

  const searchHits = cities.filter((city) =>
    arabicSearchMatches(bostaCitySearchText(city), hint),
  );
  if (searchHits.length === 1) return searchHits[0];

  if (searchHits.length > 1) {
    const best = searchHits.find((city) =>
      governmentNamesMatch(hint, bostaCityLabel(city)),
    );
    if (best) return best;
    return searchHits[0];
  }

  const normalizedHint = normalizeArabicSearchText(hint);
  return (
    cities.find((city) => {
      const label = normalizeArabicSearchText(bostaCityLabel(city));
      return (
        label.includes(normalizedHint) ||
        normalizedHint.includes(label)
      );
    }) ?? null
  );
}

export function findBostaDistrictByName(districts, nameHint) {
  const hint = String(nameHint ?? "").trim();
  if (!hint || !Array.isArray(districts) || districts.length === 0) return null;

  const exact = districts.find((district) =>
    governmentNamesMatch(hint, bostaDistrictLabel(district)),
  );
  if (exact) return exact;

  const searchHits = districts.filter((district) =>
    arabicSearchMatches(bostaDistrictSearchText(district), hint),
  );
  if (searchHits.length === 1) return searchHits[0];
  if (searchHits.length > 1) {
    const best = searchHits.find((district) =>
      governmentNamesMatch(hint, bostaDistrictLabel(district)),
    );
    return best ?? searchHits[0];
  }

  return null;
}

/** يستخرج جزء المنطقة من عنوان الطلب (بعد اسم المحافظة). */
export function parseDistrictHintFromAddress(address, governmentName) {
  const raw = String(address ?? "").trim();
  if (!raw) return "";

  const parts = raw
    .split(/[-–—,،]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";

  const gov = normalizeArabicSearchText(governmentName);
  let start = 0;
  if (gov && governmentNamesMatch(parts[0], governmentName)) {
    start = 1;
  }

  return parts[start] ?? "";
}

export function pickOrderBostaCityId(order) {
  if (!order || typeof order !== "object") return "";
  return String(
    order.bosta_city_id ??
      order.bostaCityId ??
      order.city_id ??
      order.cityId ??
      "",
  ).trim();
}

export function pickOrderBostaDistrictId(order) {
  if (!order || typeof order !== "object") return "";
  return String(
    order.bosta_district_id ??
      order.bostaDistrictId ??
      order.district_id ??
      order.districtId ??
      "",
  ).trim();
}

/** Prefer form selection, then values already stored on the order. */
export function resolveBostaLocationForSend(form, order) {
  const cityId =
    String(form?.cityId ?? "").trim() || pickOrderBostaCityId(order);
  const districtId =
    String(form?.districtId ?? "").trim() || pickOrderBostaDistrictId(order);
  return { cityId, districtId };
}
