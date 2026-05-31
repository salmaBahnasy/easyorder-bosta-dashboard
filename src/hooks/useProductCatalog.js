import { useEffect, useMemo, useRef, useState } from "react";
import { getProducts } from "../api/ordersApi";
import { productOptionId } from "../pages/orders/cartCatalogHelpers";
import { normalizeProductListFromApi } from "../utils/normalizeProductListFromApi";
import { useDebouncedValue } from "../utils/useDebouncedValue";

export function useProductCatalog(cartItems = []) {
  const [productSearch, setProductSearch] = useState("");
  const debouncedSearch = useDebouncedValue(productSearch, 300);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const cacheRef = useRef(new Map());

  function rememberProducts(list) {
    (list ?? []).forEach((product, index) => {
      cacheRef.current.set(productOptionId(product, index), product);
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const data = await getProducts({
          page: 1,
          limit: 100,
          search: debouncedSearch,
        });
        const list = normalizeProductListFromApi(data);
        rememberProducts(list);
        if (!cancelled) setCatalogProducts(list);
      } catch (e) {
        console.log(e);
        if (!cancelled) setCatalogProducts([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const catalogProductsForSelect = useMemo(() => {
    const seen = new Set();
    const merged = [];

    function addProduct(product, index) {
      const optionId = productOptionId(product, index);
      if (!optionId || seen.has(optionId)) return;
      seen.add(optionId);
      merged.push(product);
    }

    for (const row of cartItems ?? []) {
      const optionId = String(row?.catalogOptionId ?? "").trim();
      if (optionId && cacheRef.current.has(optionId)) {
        addProduct(cacheRef.current.get(optionId), 0);
      }
    }

    catalogProducts.forEach((product, index) => addProduct(product, index));
    return merged;
  }, [catalogProducts, cartItems]);

  return {
    catalogProducts: catalogProductsForSelect,
    catalogLoading,
    onCatalogSearchChange: setProductSearch,
  };
}
