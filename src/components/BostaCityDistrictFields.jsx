import { useEffect, useMemo, useRef, useState } from "react";
import { getBostaCities, getBostaDistricts } from "../api/ordersApi";
import SearchableSelect from "./SearchableSelect";
import {
  bostaCityId,
  bostaCityLabel,
  bostaCitySearchText,
  bostaDistrictId,
  bostaDistrictLabel,
  bostaDistrictSearchText,
  findBostaCityByName,
  findBostaDistrictByName,
  normalizeBostaCities,
  normalizeBostaDistricts,
} from "../utils/bostaLocation";
import { useDebouncedValue } from "../utils/useDebouncedValue";

function mergeSelectedOption(options, selected, getId, activeValue = "") {
  if (!selected || !activeValue) return options;
  const selectedId = getId(selected);
  if (!selectedId || selectedId !== String(activeValue).trim()) return options;
  if (options.some((item) => getId(item) === selectedId)) return options;
  return [selected, ...options];
}

/**
 * محافظة + منطقة (Bosta) مع بحث عبر الـ API — إنشاء الطلب وتفاصيل الطلب.
 */
export default function BostaCityDistrictFields({
  cityId = "",
  districtId = "",
  cityNameHint = "",
  districtNameHint = "",
  onCityChange,
  onDistrictChange,
  rowClassName = "order-details-page__fields-row order-details-page__fields-row--duo",
  cityLabel = "المحافظة",
  districtLabel = "المنطقة",
}) {
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState(null);
  const debouncedCitySearch = useDebouncedValue(citySearch, 300);

  const [districts, setDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [districtSearch, setDistrictSearch] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const debouncedDistrictSearch = useDebouncedValue(districtSearch, 300);
  const activeCityIdRef = useRef("");
  const districtsFetchSeqRef = useRef(0);
  const previousCityIdRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    const term = String(debouncedCitySearch ?? "").trim();

    async function loadCities() {
      setCitiesLoading(true);
      try {
        const result = await getBostaCities(term ? { q: term } : {});
        if (!cancelled) setCities(normalizeBostaCities(result));
      } catch (e) {
        console.log(e);
        if (!cancelled) setCities([]);
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    }

    loadCities();
    return () => {
      cancelled = true;
    };
  }, [debouncedCitySearch]);

  useEffect(() => {
    const id = String(cityId ?? "").trim();
    activeCityIdRef.current = id;
    const cityChanged = previousCityIdRef.current !== id;
    previousCityIdRef.current = id;

    if (!id) {
      setDistricts([]);
      setSelectedDistrict(null);
      setDistrictSearch("");
      setDistrictsLoading(false);
      return undefined;
    }

    if (cityChanged) {
      setDistricts([]);
      setDistrictSearch("");
    }

    const fetchSeq = ++districtsFetchSeqRef.current;
    const term = cityChanged
      ? ""
      : String(debouncedDistrictSearch ?? "").trim();

    let cancelled = false;

    async function loadDistricts() {
      setDistrictsLoading(true);
      try {
        const result = await getBostaDistricts(id, term ? { q: term } : {});
        const list = normalizeBostaDistricts(result);
        if (
          cancelled ||
          fetchSeq !== districtsFetchSeqRef.current ||
          activeCityIdRef.current !== id
        ) {
          return;
        }
        setDistricts(list);
      } catch (e) {
        console.log(e);
        if (
          !cancelled &&
          fetchSeq === districtsFetchSeqRef.current &&
          activeCityIdRef.current === id
        ) {
          setDistricts([]);
        }
      } finally {
        if (
          !cancelled &&
          fetchSeq === districtsFetchSeqRef.current &&
          activeCityIdRef.current === id
        ) {
          setDistrictsLoading(false);
        }
      }
    }

    loadDistricts();
    return () => {
      cancelled = true;
    };
  }, [cityId, debouncedDistrictSearch]);

  useEffect(() => {
    if (!cityId) {
      setSelectedCity(null);
      return;
    }
    const found = cities.find((city) => bostaCityId(city) === String(cityId).trim());
    if (found) setSelectedCity(found);
  }, [cityId, cities]);

  useEffect(() => {
    if (!districtId) {
      setSelectedDistrict(null);
      return;
    }
    const found = districts.find(
      (district) => bostaDistrictId(district) === String(districtId).trim(),
    );
    if (found) {
      setSelectedDistrict(found);
      return;
    }
    if (!districtsLoading && districts.length > 0) {
      setSelectedDistrict(null);
    }
  }, [districtId, districts, districtsLoading]);

  useEffect(() => {
    const hint = String(cityNameHint ?? "").trim();
    if (!hint || cityId) return;

    let cancelled = false;

    async function matchCityFromHint() {
      try {
        const result = await getBostaCities({ q: hint });
        const list = normalizeBostaCities(result);
        if (cancelled || list.length === 0) return;
        const match = findBostaCityByName(list, hint);
        if (match) {
          setSelectedCity(match);
          onCityChange?.(bostaCityId(match), match);
        }
      } catch (e) {
        console.log(e);
      }
    }

    matchCityFromHint();
    return () => {
      cancelled = true;
    };
  }, [cityNameHint, cityId, onCityChange]);

  useEffect(() => {
    const hint = String(districtNameHint ?? "").trim();
    const id = String(cityId ?? "").trim();
    if (!hint || !id || districtId) return;

    let cancelled = false;

    async function matchDistrictFromHint() {
      try {
        const result = await getBostaDistricts(id, { q: hint });
        const list = normalizeBostaDistricts(result);
        if (cancelled || list.length === 0) return;
        const match = findBostaDistrictByName(list, hint);
        if (match) {
          setSelectedDistrict(match);
          onDistrictChange?.(bostaDistrictId(match));
        }
      } catch (e) {
        console.log(e);
      }
    }

    matchDistrictFromHint();
    return () => {
      cancelled = true;
    };
  }, [districtNameHint, cityId, districtId, onDistrictChange]);

  const cityOptions = useMemo(
    () => mergeSelectedOption(cities, selectedCity, bostaCityId, cityId),
    [cities, selectedCity, cityId],
  );

  const districtOptions = useMemo(
    () =>
      mergeSelectedOption(
        districts,
        selectedDistrict,
        bostaDistrictId,
        districtId,
      ),
    [districts, selectedDistrict, districtId],
  );

  function handleCitySelect(nextCityId, cityOption) {
    activeCityIdRef.current = String(nextCityId ?? "").trim();
    districtsFetchSeqRef.current += 1;
    setSelectedCity(cityOption ?? null);
    setDistricts([]);
    setSelectedDistrict(null);
    setDistrictSearch("");
    setDistrictsLoading(Boolean(nextCityId));
    onCityChange?.(nextCityId, cityOption);
    onDistrictChange?.("");
  }

  function handleDistrictSelect(nextDistrictId, districtOption) {
    setSelectedDistrict(districtOption ?? null);
    onDistrictChange?.(nextDistrictId);
  }

  return (
    <div className={rowClassName}>
      <label className="order-details-page__field">
        {cityLabel}
        <SearchableSelect
          value={cityId}
          onChange={handleCitySelect}
          options={cityOptions}
          getOptionValue={bostaCityId}
          getOptionLabel={bostaCityLabel}
          getOptionSearchText={bostaCitySearchText}
          placeholder="اختر المحافظة"
          searchPlaceholder="ابحث عن المحافظة..."
          loading={citiesLoading}
          loadingText="جاري تحميل المحافظات..."
          emptyText="لا توجد محافظة مطابقة"
          serverSideSearch
          onSearchChange={setCitySearch}
        />
      </label>
      <label className="order-details-page__field">
        {districtLabel}
        <SearchableSelect
          value={districtId}
          onChange={handleDistrictSelect}
          options={districtOptions}
          getOptionValue={bostaDistrictId}
          getOptionLabel={bostaDistrictLabel}
          getOptionSearchText={bostaDistrictSearchText}
          placeholder={!cityId ? "اختر المحافظة أولاً" : "اختر المنطقة"}
          searchPlaceholder="ابحث عن المنطقة..."
          disabled={!cityId}
          loading={districtsLoading}
          loadingText="جاري تحميل المناطق..."
          emptyText="لا توجد منطقة مطابقة"
          serverSideSearch
          onSearchChange={setDistrictSearch}
        />
      </label>
    </div>
  );
}
