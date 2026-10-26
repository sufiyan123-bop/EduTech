import { createHmac, timingSafeEqual } from "node:crypto";
export function signatureMatches(data, signature, secret) {
  if (typeof data !== "string" || typeof signature !== "string" || typeof secret !== "string" || !/^[a-f\d]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha256", secret).update(data).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
export function checkoutSignatureMatches(orderId, paymentId, signature, secret) {
  return typeof orderId === "string" && typeof paymentId === "string" && signatureMatches(orderId + "|" + paymentId, signature, secret);
}
export function webhookSignatureMatches(rawBody, signature, secret) {
  return (typeof rawBody === "string" || Buffer.isBuffer(rawBody)) && signatureMatches(rawBody.toString(), signature, secret);
}
