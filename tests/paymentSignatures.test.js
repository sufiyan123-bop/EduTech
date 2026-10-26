import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkoutSignatureMatches, webhookSignatureMatches } from "../api/_lib/signatures.js";
test("checkout only accepts valid signed payment", () => {
 const secret="test_secret",orderId="order_123456",paymentId="pay_123456";
 const signature=createHmac("sha256",secret).update(orderId+"|"+paymentId).digest("hex");
 assert.equal(checkoutSignatureMatches(orderId,paymentId,signature,secret),true);
 assert.equal(checkoutSignatureMatches(orderId+"X",paymentId,signature,secret),false);
 assert.equal(checkoutSignatureMatches(orderId,paymentId,"invalid",secret),false);
});
test("webhook signature uses exact raw body", () => {
 const secret="webhook_secret",raw=Buffer.from("hello");
 const signature=createHmac("sha256",secret).update(raw).digest("hex");
 assert.equal(webhookSignatureMatches(raw,signature,secret),true);
 assert.equal(webhookSignatureMatches(Buffer.from("tampered"),signature,secret),false);
});
