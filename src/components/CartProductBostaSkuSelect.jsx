import SearchableSelect from "./SearchableSelect";

export default function CartProductBostaSkuSelect({ row, onSelect }) {
  const options = Array.isArray(row?.bostaSkuOptions) ? row.bostaSkuOptions : [];

  if (row?.bostaSkusLoading) {
    return (
      <div
        className="cart-bosta-sku-select cart-bosta-sku-select--loading"
        aria-live="polite"
      >
        <span className="cart-bosta-sku-select__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (options.length === 0) return null;

  return (
    <div className="cart-bosta-sku-select">
      <SearchableSelect
        className="cart-bosta-sku-select__control"
        value={row?.selectedBostaSkuCode ?? ""}
        onChange={(skuCode) => onSelect?.(skuCode)}
        options={options}
        getOptionValue={(opt) => opt.skuCode}
        getOptionLabel={(opt) => opt.label}
        placeholder="SKU بوسطة"
        emptyText="لا توجد SKUs"
        hideSearch={options.length <= 6}
        panelFixed
      />
    </div>
  );
}
