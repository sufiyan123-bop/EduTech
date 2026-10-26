// Shared duration and access logic for the browser and trusted payment server.
export const PLAN_MONTHS = [1, 3, 6, 12];
export function planPriceInPaise(course, months) {
  if (!PLAN_MONTHS.includes(Number(months))) return null;
  const value = course?.plans?.[String(months)];
  const rupees = typeof value === "object" && value !== null ? Number(value.price) : Number(value);
  if (!Number.isSafeInteger(rupees) || rupees <= 0 || rupees > 10000000) return null;
  return rupees * 100;
}
export function addCalendarMonths(date, months) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !PLAN_MONTHS.includes(Number(months))) throw new Error("Invalid access duration");
  const copy = new Date(date.getTime());
  const day = copy.getUTCDate();
  copy.setUTCDate(1);
  copy.setUTCMonth(copy.getUTCMonth() + Number(months));
  const last = new Date(Date.UTC(copy.getUTCFullYear(), copy.getUTCMonth() + 1, 0)).getUTCDate();
  copy.setUTCDate(Math.min(day, last));
  return copy;
}
export function enrollmentIsActive(data, now = Date.now()) {
  if (!data || data.status === "revoked" || data.status === "inactive" || data.status === "expired") return false;
  const expires = data.expiresAt;
  if (!expires) return data.source !== "razorpay"; // Preserve existing indefinite admin grants.
  const expiryMs = typeof expires.toMillis === "function" ? expires.toMillis() : expires instanceof Date ? expires.getTime() : typeof expires === "number" ? expires : NaN;
  return Number.isFinite(expiryMs) && expiryMs > now;
}
export function enrollmentExpiryMs(data) {
  if (!data?.expiresAt) return data?.source === "razorpay" ? 0 : Infinity;
  const value = data.expiresAt;
  return typeof value.toMillis === "function" ? value.toMillis() : value instanceof Date ? value.getTime() : typeof value === "number" ? value : 0;
}
