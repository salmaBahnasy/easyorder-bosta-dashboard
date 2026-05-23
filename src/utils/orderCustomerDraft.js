import { getOrderGovernmentName } from "./bostaLocation";
import { normalizePhoneDigits } from "./createOrderValidation";
import { orderAddress, orderCustomer, orderPhone } from "./orderDisplay";

function pickText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "—") return text;
  }
  return "";
}

/**
 * Maps an existing order to create-order form fields (repeat customer flow).
 */
export function buildCreateOrderDraftFromOrder(order) {
  if (!order || typeof order !== "object") {
    return null;
  }

  const firstName = pickText(
    orderCustomer(order),
    order.full_name,
    order.fullName,
    order.firstName,
    order.first_name,
  );
  const mobile = normalizePhoneDigits(
    pickText(orderPhone(order), order.phone, order.mobile),
  );
  const firstLine = pickText(
    orderAddress(order),
    order.address,
    order.first_line,
    order.firstLine,
  );
  const cityName = pickText(
    getOrderGovernmentName(order),
    order.city,
    order.cityName,
  );

  const cityId = pickText(
    order.city_id,
    order.cityId,
    order.bosta_city_id,
    order.bostaCityId,
  );
  const districtId = pickText(
    order.district_id,
    order.districtId,
    order.bosta_district_id,
    order.bostaDistrictId,
  );

  return {
    firstName,
    mobile,
    firstLine,
    cityName,
    cityId,
    districtId,
    order_source: "old_customer",
  };
}
