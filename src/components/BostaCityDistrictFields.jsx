import { useEffect, useState } from "react";
import { getBostaCities, getBostaDistricts } from "../api/ordersApi";
import SearchableSelect from "./SearchableSelect";
import {
  bostaCityId,
  bostaCityLabel,
  bostaCitySearchText,
  bostaDistrictId,
  bostaDistrictLabel,
  bostaDistrictSearchText,
  normalizeBostaCities,
  normalizeBostaDistricts,
} from "../utils/bostaLocation";

/**
 * محافظة + منطقة (Bosta) مع بحث — يُستخدم في إنشاء الطلب وتفاصيل الطلب.
 */
export default function BostaCityDistrictFields({
  cityId = "",
  districtId = "",
  onCityChange,
  onDistrictChange,
  rowClassName = "order-details-page__fields-row order-details-page__fields-row--duo",
  cityLabel = "المحافظة",
  districtLabel = "المنطقة",
}) {
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      try {
        setCitiesLoading(true);
        const result = await getBostaCities();
        const list = normalizeBostaCities(result);
        if (!cancelled) setCities(list);
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
  }, []);

  useEffect(() => {
    const id = String(cityId ?? "").trim();
    if (!id) {
      setDistricts([]);
      return undefined;
    }

    let cancelled = false;

    async function loadDistricts() {
      try {
        setDistrictsLoading(true);
        const result = await getBostaDistricts(id);
        const list = normalizeBostaDistricts(result);
        if (!cancelled) setDistricts(list);
      } catch (e) {
        console.log(e);
        if (!cancelled) setDistricts([]);
      } finally {
        if (!cancelled) setDistrictsLoading(false);
      }
    }

    loadDistricts();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  function handleCitySelect(nextCityId, cityOption) {
    onCityChange?.(nextCityId, cityOption);
    onDistrictChange?.("");
  }

  return (
    <div className={rowClassName}>
      <label className="order-details-page__field">
        {cityLabel}
        <SearchableSelect
          value={cityId}
          onChange={handleCitySelect}
          options={cities}
          getOptionValue={bostaCityId}
          getOptionLabel={bostaCityLabel}
          getOptionSearchText={bostaCitySearchText}
          placeholder="اختر المحافظة"
          searchPlaceholder="ابحث عن المحافظة..."
          loading={citiesLoading}
          loadingText="جاري تحميل المحافظات..."
          emptyText="لا توجد محافظة مطابقة"
        />
      </label>
      <label className="order-details-page__field">
        {districtLabel}
        <SearchableSelect
          value={districtId}
          onChange={(nextDistrictId) => onDistrictChange?.(nextDistrictId)}
          options={districts}
          getOptionValue={bostaDistrictId}
          getOptionLabel={bostaDistrictLabel}
          getOptionSearchText={bostaDistrictSearchText}
          placeholder={!cityId ? "اختر المحافظة أولاً" : "اختر المنطقة"}
          searchPlaceholder="ابحث عن المنطقة..."
          disabled={!cityId}
          loading={districtsLoading}
          loadingText="جاري تحميل المناطق..."
          emptyText="لا توجد منطقة مطابقة"
        />
      </label>
    </div>
  );
}
