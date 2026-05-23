import { useEffect, useId, useMemo, useRef, useState } from "react";
import { arabicSearchMatches } from "../utils/arabicSearch";
import "./SearchableSelect.css";

function buildHaystack(option, getOptionLabel, getOptionSearchText) {
  const label = getOptionLabel(option);
  const extra = getOptionSearchText ? getOptionSearchText(option) : "";
  return [label, extra].filter((s) => s && s !== "—").join(" ");
}

function matchesSearch(option, query, getSearchText, getOptionLabel) {
  const haystack = buildHaystack(option, getOptionLabel, getSearchText);
  return arabicSearchMatches(haystack, query);
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  getOptionValue,
  getOptionLabel,
  getOptionSearchText,
  placeholder = "اختر...",
  searchPlaceholder = "ابحث...",
  disabled = false,
  loading = false,
  emptyText = "لا توجد نتائج",
  loadingText = "جاري التحميل...",
  className = "",
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => options.find((opt) => getOptionValue(opt) === value) ?? null,
    [options, value, getOptionValue],
  );

  const filteredOptions = useMemo(() => {
    const q = String(search ?? "").trim();
    if (!q) return options;
    return options.filter((opt) =>
      matchesSearch(opt, q, getOptionSearchText, getOptionLabel),
    );
  }, [options, search, getOptionSearchText, getOptionLabel]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setSearch("");
    return undefined;
  }, [open]);

  function handleSearchChange(next) {
    setSearch(next);
  }

  function handleSelect(option) {
    onChange(getOptionValue(option), option);
    setOpen(false);
    setSearch("");
  }

  function handleToggle() {
    if (disabled || loading) return;
    setOpen((prev) => !prev);
  }

  function handlePanelMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const displayText = selected
    ? getOptionLabel(selected)
    : loading
      ? loadingText
      : placeholder;

  return (
    <div
      ref={rootRef}
      className={`searchable-select ${open ? "searchable-select--open" : ""} ${disabled ? "searchable-select--disabled" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="searchable-select__trigger order-details-page__input"
        onClick={handleToggle}
        disabled={disabled || loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
      >
        <span
          className={`searchable-select__trigger-text ${!selected ? "searchable-select__trigger-text--placeholder" : ""}`}
        >
          {displayText}
        </span>
        <span className="searchable-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="searchable-select__panel"
          onMouseDown={handlePanelMouseDown}
        >
          <input
            ref={searchRef}
            type="text"
            className="searchable-select__search order-details-page__input"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onInput={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            dir="rtl"
            aria-controls={listId}
            aria-autocomplete="list"
          />
          <ul
            id={listId}
            className="searchable-select__list"
            role="listbox"
            dir="rtl"
          >
            {loading ? (
              <li className="searchable-select__empty">{loadingText}</li>
            ) : filteredOptions.length === 0 ? (
              <li className="searchable-select__empty">{emptyText}</li>
            ) : (
              filteredOptions.map((option, index) => {
                const optValue = getOptionValue(option);
                const isSelected = optValue === value;
                return (
                  <li
                    key={optValue || `${getOptionLabel(option)}-${index}`}
                    role="presentation"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`searchable-select__option ${isSelected ? "searchable-select__option--selected" : ""}`}
                      onClick={() => handleSelect(option)}
                    >
                      {getOptionLabel(option)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
