export function normalizePhoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function filterCartLinesForPayload(cartItems) {
  return (cartItems ?? []).filter(
    (row) =>
      String(row.name ?? "").trim() !== "" || String(row.sku ?? "").trim() !== "",
  );
}

/**
 * @returns {{ valid: boolean, errors: string[], linesForPayload: object[], phoneDigits: string, phone2Digits: string }}
 */
export function validateCreateOrderForm(form, cartItems) {
  const errors = [];
  const linesForPayload = filterCartLinesForPayload(cartItems);

  if (linesForPayload.length === 0) {
    errors.push("يجب إضافة منتج واحد على الأقل");
  }

  const phoneDigits = normalizePhoneDigits(form?.mobile);
  if (!phoneDigits) {
    errors.push("رقم الموبايل مطلوب");
  } else if (phoneDigits.length !== 11) {
    errors.push("رقم الموبايل يجب أن يكون 11 رقمًا");
  }

  const phone2Digits = normalizePhoneDigits(form?.mobile2);
  if (phone2Digits && phone2Digits.length !== 11) {
    errors.push("رقم الموبايل الثاني يجب أن يكون 11 رقمًا");
  }

  if (!String(form?.firstLine ?? "").trim()) {
    errors.push("العنوان مطلوب");
  }

  if (!String(form?.cityId ?? "").trim()) {
    errors.push("المحافظة مطلوبة");
  }

  if (!String(form?.districtId ?? "").trim()) {
    errors.push("المنطقة مطلوبة");
  }

  return {
    valid: errors.length === 0,
    errors,
    linesForPayload,
    phoneDigits,
    phone2Digits,
  };
}
