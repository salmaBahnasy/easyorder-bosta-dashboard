export function normalizeBostaCities(payload) {
  const list = payload?.data?.list;
  if (Array.isArray(list)) return list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function normalizeBostaDistricts(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function bostaCityLabel(city) {
  const label = String(city?.nameAr ?? "").trim();
  return label || "—";
}

export function bostaDistrictLabel(district) {
  const label = String(
    district?.districtOtherName ??
      district?.districtName ??
      district?.zoneOtherName ??
      district?.zoneName ??
      "",
  ).trim();
  return label || "—";
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
