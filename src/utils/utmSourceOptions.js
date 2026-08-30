const UTM_SOURCE_LABELS = {
  ig: "Instagram",
  fb: "Facebook",
  tiktok: "TikTok",
};

const FALLBACK_UTM_SOURCES = ["ig", "fb", "tiktok"];

function pickUtmValue(item) {
  if (item == null || item === "") return "";
  if (typeof item === "string" || typeof item === "number") {
    return String(item).trim();
  }
  if (typeof item === "object") {
    return String(
      item.value ?? item.id ?? item.key ?? item.utm_source ?? item.utmSource ?? "",
    ).trim();
  }
  return "";
}

function pickUtmLabel(item, value) {
  if (item && typeof item === "object") {
    const label = String(item.label ?? item.name ?? item.title ?? "").trim();
    if (label) return label;
  }
  return UTM_SOURCE_LABELS[String(value).toLowerCase()] ?? value;
}

export function utmSourceDisplayLabel(value) {
  const key = String(value ?? "").trim();
  if (!key) return "";
  return UTM_SOURCE_LABELS[key.toLowerCase()] ?? key;
}

/** يبني خيارات الدروب داون من filterLists.utmSource أو القيم الافتراضية. */
export function normalizeUtmSourceOptions(raw) {
  const list = Array.isArray(raw) ? raw : FALLBACK_UTM_SOURCES;
  const options = [];
  const seen = new Set();

  for (const item of list) {
    const value = pickUtmValue(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: pickUtmLabel(item, value) });
  }

  if (options.length === 0) {
    return FALLBACK_UTM_SOURCES.map((value) => ({
      value,
      label: UTM_SOURCE_LABELS[value],
    }));
  }

  return options;
}

function toUtmCountMap(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const map = {};
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const key = pickUtmValue(item) || "(empty)";
      const count = Number(
        item.count ??
          item.value ??
          item.total ??
          item.orders ??
          item.totalOrders ??
          0,
      );
      map[key] = (map[key] || 0) + (Number.isFinite(count) ? count : 0);
    }
    return map;
  }
  if (typeof value === "object") {
    const map = {};
    for (const [rawKey, rawVal] of Object.entries(value)) {
      const key = String(rawKey ?? "").trim() || "(empty)";
      const count =
        rawVal && typeof rawVal === "object"
          ? Number(
              rawVal.count ??
                rawVal.value ??
                rawVal.total ??
                rawVal.orders ??
                0,
            ) || 0
          : Number(rawVal) || 0;
      map[key] = (map[key] || 0) + count;
    }
    return map;
  }
  return null;
}

/** يقرأ توزيع utm_source من استجابة الإحصائيات. */
export function pickStatsUtmSourceMap(stats) {
  if (!stats || typeof stats !== "object") return {};
  const nodes = [stats, stats.stats, stats.data, stats.data?.stats];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const candidates = [
      node.byUtmSource,
      node.by_utm_source,
      node.byUtmSources,
      node.utmSources,
      typeof node.utmSource === "object" ? node.utmSource : null,
      typeof node.utm_source === "object" ? node.utm_source : null,
      node.byUtm,
    ];
    for (const candidate of candidates) {
      const map = toUtmCountMap(candidate);
      if (map && Object.keys(map).length > 0) return map;
    }
  }
  return {};
}

export function pickFilterListsUtmSource(payload) {
  if (!payload || typeof payload !== "object") return null;
  const lists =
    payload.filterLists ??
    payload.filter_lists ??
    payload.data?.filterLists ??
    payload.data?.filter_lists ??
    payload.stats?.filterLists ??
    payload.chart?.filterLists ??
    null;
  if (!lists || typeof lists !== "object") return null;
  return lists.utmSource ?? lists.utm_source ?? lists.utmSources ?? null;
}
