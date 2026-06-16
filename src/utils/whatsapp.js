/** إزالة أحرف تالفة قد تفسد ترميز UTF-8 في رابط واتساب */
export function sanitizeWhatsAppText(value) {
  const text = String(value ?? "");
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    if (code === 0xfffd || code < 0x20) {
      if (code === 0x0a || code === 0x0d || code === 0x09) out += text[i];
      continue;
    }
    out += text[i];
  }
  return out.trim();
}

export const WA_EMOJI = {
  flower: String.fromCodePoint(0x1f337),
  smile: String.fromCodePoint(0x1f60a),
  package: String.fromCodePoint(0x1f4e6),
  bed: String.fromCodePoint(0x1f6cf, 0xfe0f),
  cash: String.fromCodePoint(0x1f4b5),
  truck: String.fromCodePoint(0x1f69a),
  moneyBag: String.fromCodePoint(0x1f4b0),
  pin: String.fromCodePoint(0x1f4cd),
  phone: String.fromCodePoint(0x1f4de),
  warning: String.fromCodePoint(0x26a0, 0xfe0f),
  leaf: String.fromCodePoint(0x1f33f),
  heart: String.fromCodePoint(0x2764, 0xfe0f),
};

export function buildWhatsAppConfirmMessage(order, productsText) {
  const name = sanitizeWhatsAppText(order?.full_name ?? order?.customerName ?? "");
  const orderRef = sanitizeWhatsAppText(order?.orderReference ?? order?.orderRef ?? "");
  const address = sanitizeWhatsAppText(order?.address ?? "");
  const phone = sanitizeWhatsAppText(order?.phone ?? "");
  const productCost = order?.cost ?? 0;
  const shippingCost = order?.shipping_cost ?? order?.expense ?? 0;
  const totalCost = order?.total_cost ?? 0;
  const products = sanitizeWhatsAppText(productsText);

  return [
    `${WA_EMOJI.flower} مرحبًا ${name}`,
    "",
    `${WA_EMOJI.smile} مع حضرتك فريق عناية`,
    "",
    "نود تأكيد بيانات طلبكم قبل الشحن:",
    "",
    `${WA_EMOJI.package} رقم الطلب: #${orderRef}`,
    "",
    `${WA_EMOJI.bed} المنتجات المطلوبة:`,
    products,
    "",
    `${WA_EMOJI.cash} قيمة المنتجات: ${productCost} جنيه`,
    `${WA_EMOJI.truck} مصاريف الشحن: ${shippingCost} جنيه`,
    `${WA_EMOJI.moneyBag} المطلوب عند الاستلام: ${totalCost} جنيه`,
    "",
    `${WA_EMOJI.pin} عنوان التوصيل:`,
    address,
    "",
    `${WA_EMOJI.phone} رقم الهاتف: ${phone}`,
    "",
    "برجاء الرد بأحد الخيارات التالية:",
    "",
    "1 - تأكيد الطلب",
    "2 - تعديل البيانات",
    "3 - إلغاء الطلب",
    "",
    `${WA_EMOJI.warning} في حال عدم الرد خلال 24 ساعة قد يتأخر تجهيز الطلب.`,
    "",
    `${WA_EMOJI.leaf}${WA_EMOJI.heart} نشكر ثقتكم في عناية`,
  ].join("\n");
}

/** رابط واتساب مع ترميز UTF-8 آمن للإيموجي */
export function buildWhatsAppSendUrl(phone, message) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const url = new URL(`https://api.whatsapp.com/send`);
  url.searchParams.set("phone", digits);
  url.searchParams.set("text", message);
  return url.toString();
}
