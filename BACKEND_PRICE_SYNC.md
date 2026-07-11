# Backend: مزامنة أسعار ومنتجات النظام مع بوسطة

طبّقي هذه التعديلات على `easyorder-bosta-backend` بعد توصيل القرص.

## 1) `src/services/bostaFulfillment.service.js`

أضيفي/حدّثي دالة السعر لتفضّل `sale_price` من الكتالوج الحي:

```js
function resolveEffectiveCatalogPrice(productLike) {
  if (!productLike || typeof productLike !== "object") return 0;
  const sale = Number(productLike.sale_price ?? 0);
  const regular = Number(productLike.price ?? 0);
  if (Number.isFinite(sale) && sale > 0) return sale;
  if (Number.isFinite(regular) && regular > 0) return regular;
  return 0;
}

function pickLineUnitPrice(line, { lineSkuOverride } = {}) {
  const overridePrice = Number(lineSkuOverride?.price ?? 0);
  if (Number.isFinite(overridePrice) && overridePrice > 0) return overridePrice;

  const direct = Number(line?.price ?? line?.unit_price ?? 0);
  const variant = line?.variant && typeof line.variant === "object" ? line.variant : null;
  const product = line?.product && typeof line.product === "object" ? line.product : null;

  const variantPrice = resolveEffectiveCatalogPrice(variant);
  if (variantPrice > 0) return variantPrice;

  const productPrice = resolveEffectiveCatalogPrice(product);
  if (productPrice > 0) return productPrice;

  return Number.isFinite(direct) && direct > 0 ? direct : 0;
}
```

تأكدي أن `buildBostaItemsFromOrder` يمرّر `lineSkus` override لكل سطر عند وجوده.

## 2) `src/services/products.service.js`

عند sync من EasyOrders، خزّني `sale_price` في `raw_data` وعلى جذر الصف:

```js
const sale_price = Number(apiProduct.sale_price ?? 0) || null;
const price = Number(apiProduct.price ?? 0) || null;

const row = {
  easyorder_id: apiProduct.id,
  name: apiProduct.name,
  sku: apiProduct.sku ?? null,
  price,
  sale_price,
  raw_data: apiProduct,
  synced_at: new Date().toISOString(),
};
```

وفي `listProducts` أرجعي السعر الفعلي:

```js
function effectivePrice(row) {
  const rd = row?.raw_data ?? {};
  const sale = Number(row.sale_price ?? rd.sale_price ?? 0);
  const regular = Number(row.price ?? rd.price ?? 0);
  if (sale > 0) return sale;
  return regular > 0 ? regular : null;
}
```

## 4) طلبات متعددة المنتجات (multi-line)

في `buildBostaItemsFromOrder` تأكدي أن **كل** عنصر في `cart_items` يتحول لسطر في `items[]` لبوسطة:

```js
// لكل سطر في cart_items (بنفس ترتيب lineIndex)
items.push({
  skuCode: resolvedSku,      // من lineSkus[lineIndex] أو mapping
  quantity: line.quantity,    // كمية السطر (مثلاً 2 أو 3)
  price: pickLineUnitPrice(line, { lineSkuOverride }),
});
```

لا تستخدمي `cart_items[0]` فقط — الطلب قد يحتوي عدة منتجات أو نفس المنتج بكميات مختلفة.


```bash
# مزامنة المنتجات من EasyOrders
curl -X POST https://easyorder-bosta-backend.onrender.com/api/easyorder/products/sync

# ثم أعيدي نشر الـ backend على Render
```

## ما تم في الـ Dashboard (جاهز)

- عرض `sale_price` في صفحة المنتجات
- جلب السعر الحي من EasyOrders عند اختيار منتج في الطلب
- إرسال نفس السعر مع `lineSkus` إلى بوسطة عند الشحن
