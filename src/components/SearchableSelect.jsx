import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  serverSideSearch = false,
  onSearchChange,
  panelFixed = false,
  hideSearch = false,
  multiple = false,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelStyle, setPanelStyle] = useState(null);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return (Array.isArray(value) ? value : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
    const single = String(value ?? "").trim();
    return single ? [single] : [];
  }, [multiple, value]);

  const selected = useMemo(() => {
    if (multiple) {
      return options.filter((opt) =>
        selectedValues.includes(String(getOptionValue(opt))),
      );
    }
    return options.find((opt) => getOptionValue(opt) === value) ?? null;
  }, [options, value, getOptionValue, multiple, selectedValues]);

  const filteredOptions = useMemo(() => {
    if (serverSideSearch) return options;
    const q = String(search ?? "").trim();
    if (!q) return options;
    return options.filter((opt) =>
      matchesSearch(opt, q, getOptionSearchText, getOptionLabel),
    );
  }, [options, search, getOptionSearchText, getOptionLabel, serverSideSearch]);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector(".searchable-select__trigger");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(320, openUp ? spaceAbove - 8 : spaceBelow - 8);

    setPanelStyle({
      position: "fixed",
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width,
      zIndex: 10050,
      maxHeight: Math.max(160, maxHeight),
    });
  }, []);

  useEffect(() => {
    if (!open || !panelFixed) return undefined;

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, panelFixed, updatePanelPosition, filteredOptions.length, loading]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
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
      if (serverSideSearch) {
        onSearchChange?.("");
      }
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setSearch("");
    return undefined;
  }, [open, serverSideSearch, onSearchChange]);

  function handleSearchChange(next) {
    setSearch(next);
    if (serverSideSearch) {
      onSearchChange?.(next);
    }
  }

  function handleSelect(option) {
    const nextValue = getOptionValue(option);
    if (multiple) {
      const id = String(nextValue ?? "").trim();
      if (!id) return;
      const next = selectedValues.includes(id)
        ? selectedValues.filter((item) => item !== id)
        : [...selectedValues, id];
      onChange(next, option);
      return;
    }
    onChange(nextValue, option);
    setOpen(false);
    setSearch("");
  }

  function handleClearMultiple() {
    if (!multiple) return;
    onChange([]);
  }

  function handleToggle() {
    if (disabled || loading) return;
    setOpen((prev) => {
      const next = !prev;
      if (next && panelFixed) {
        window.requestAnimationFrame(() => updatePanelPosition());
      }
      return next;
    });
  }

  function handlePanelMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const displayText = (() => {
    if (loading) return loadingText;
    if (multiple) {
      if (selectedValues.length === 0) return placeholder;
      if (selectedValues.length === 1) {
        const only = Array.isArray(selected) ? selected[0] : null;
        return only ? getOptionLabel(only) : placeholder;
      }
      return `${selectedValues.length} منتجات`;
    }
    return selected ? getOptionLabel(selected) : placeholder;
  })();

  const hasSelection = multiple
    ? selectedValues.length > 0
    : Boolean(selected);

  const panelNode = open ? (
    <div
      ref={panelRef}
      className={`searchable-select__panel ${panelFixed ? "searchable-select__panel--fixed" : ""}`.trim()}
      style={panelFixed ? panelStyle ?? undefined : undefined}
      onMouseDown={handlePanelMouseDown}
    >
      {!hideSearch ? (
        <div className="searchable-select__search-wrap">
          <span className="searchable-select__search-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="m14 14 3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="search"
            className="searchable-select__search"
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
        </div>
      ) : null}
      <ul
        id={listId}
        className="searchable-select__list"
        role="listbox"
        aria-multiselectable={multiple || undefined}
        dir="rtl"
      >
        {loading ? (
          <li className="searchable-select__empty">{loadingText}</li>
        ) : filteredOptions.length === 0 ? (
          <li className="searchable-select__empty">{emptyText}</li>
        ) : (
          filteredOptions.map((option, index) => {
            const optValue = getOptionValue(option);
            const isSelected = selectedValues.includes(String(optValue));
            return (
              <li
                key={optValue || `${getOptionLabel(option)}-${index}`}
                role="presentation"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`searchable-select__option ${multiple ? "searchable-select__option--multi" : ""} ${isSelected ? "searchable-select__option--selected" : ""}`}
                  onClick={() => handleSelect(option)}
                >
                  {multiple ? (
                    <span
                      className={`searchable-select__check ${isSelected ? "is-checked" : ""}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{getOptionLabel(option)}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {multiple && selectedValues.length > 0 ? (
        <div className="searchable-select__footer">
          <button
            type="button"
            className="searchable-select__clear"
            onClick={handleClearMultiple}
          >
            مسح الاختيار
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

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
          className={`searchable-select__trigger-text ${!hasSelection ? "searchable-select__trigger-text--placeholder" : ""}`}
          title={
            multiple
              ? Array.isArray(selected) && selected.length
                ? selected.map(getOptionLabel).join("، ")
                : undefined
              : selected
                ? getOptionLabel(selected)
                : undefined
          }
        >
          {displayText}
        </span>
        <span className="searchable-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {panelFixed && panelNode
        ? createPortal(panelNode, document.body)
        : panelNode}
    </div>
  );
}
