import SearchableSelect from "./SearchableSelect";

export default function CartProductVariantSelect({ row, onSelect }) {
  const options = Array.isArray(row?.variantOptions) ? row.variantOptions : [];

  if (row?.variantsLoading) {
    return (
      <div className="cart-variant-select cart-variant-select--loading" aria-live="polite">
        <span className="cart-variant-select__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (options.length === 0) return null;

  return (
    <div className="cart-variant-select">
      <SearchableSelect
        className="cart-variant-select__control"
        value={row?.selectedVariantId ?? ""}
        onChange={(variantId) => onSelect?.(variantId)}
        options={options}
        getOptionValue={(opt) => opt.id}
        getOptionLabel={(opt) => opt.label}
        placeholder="المقاس"
        emptyText="لا توجد مقاسات"
        hideSearch
        panelFixed
      />
    </div>
  );
}
