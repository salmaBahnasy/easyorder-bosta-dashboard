import SearchableSelect from "./SearchableSelect";
import {
  cartRowSelectValue,
  catalogProductDisplayName,
  parseProductRawData,
  productOptionId,
  unwrapCatalogProduct,
} from "../pages/orders/cartCatalogHelpers";

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

export function catalogProductOptionLabel(product, index = 0) {
  const unwrapped = unwrapCatalogProduct(product);
  const raw = parseProductRawData(unwrapped);
  const title = catalogProductDisplayName(product, index);
  const sku = String(unwrapped?.sku ?? raw.sku ?? "");
  const priceNum = Number(unwrapped?.price ?? raw.price ?? 0) || 0;
  return sku
    ? `${title} (${sku}) — ${formatMoney(priceNum)} ج`
    : `${title} — ${formatMoney(priceNum)} ج`;
}

function catalogProductSearchText(product) {
  const unwrapped = unwrapCatalogProduct(product);
  const raw = parseProductRawData(unwrapped);
  return [
    unwrapped?.name,
    unwrapped?.title,
    unwrapped?.sku,
    raw?.name,
    raw?.sku,
    raw?.taager_code,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function CartProductSelect({
  row,
  catalogProducts = [],
  catalogLoading = false,
  onSelect,
  onSearchChange,
}) {
  return (
    <SearchableSelect
      className="cart-product-select"
      value={cartRowSelectValue(row, catalogProducts)}
      onChange={(optionId) => onSelect?.(optionId)}
      options={catalogProducts}
      getOptionValue={(product) => productOptionId(product, 0)}
      getOptionLabel={(product) => catalogProductOptionLabel(product, 0)}
      getOptionSearchText={catalogProductSearchText}
      placeholder="— اختر منتجاً —"
      searchPlaceholder="ابحث بالاسم أو SKU..."
      loading={catalogLoading}
      loadingText="جاري تحميل المنتجات..."
      emptyText="لا توجد منتجات مطابقة"
      serverSideSearch
      onSearchChange={onSearchChange}
      panelFixed
    />
  );
}
