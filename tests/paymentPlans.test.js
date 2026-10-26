import test from "node:test";
import assert from "node:assert/strict";
import { planPriceInPaise, addCalendarMonths, enrollmentIsActive } from "../src/utils/paymentPlans.js";
test("only explicitly configured supported plans can be purchased", () => {
 const course={plans:{"1":999,"3":2499,"6":3999,"12":5999}};
 assert.equal(planPriceInPaise(course,1),99900);
 assert.equal(planPriceInPaise(course,3),249900);
 assert.equal(planPriceInPaise(course,12),599900);
 assert.equal(planPriceInPaise(course,2),null);
 assert.equal(planPriceInPaise({},1),null);
 assert.equal(planPriceInPaise({plans:{"1":0}},1),null);
});
test("calendar month expiration handles end-of-month and leap year", () => {
 assert.equal(addCalendarMonths(new Date("2024-01-31T08:00:00.000Z"),1).toISOString(),"2024-02-29T08:00:00.000Z");
 assert.equal(addCalendarMonths(new Date("2026-10-31T08:00:00.000Z"),1).toISOString(),"2026-11-30T08:00:00.000Z");
});
test("Razorpay payment enrollment cannot stay active without a valid expiry", () => {
 const now=Date.parse("2026-10-26T00:00:00Z");
 assert.equal(enrollmentIsActive({source:"razorpay",status:"active"},now),false);
 assert.equal(enrollmentIsActive({source:"razorpay",status:"active",expiresAt:new Date(now+1000)},now),true);
 assert.equal(enrollmentIsActive({source:"razorpay",status:"active",expiresAt:new Date(now)},now),false);
 assert.equal(enrollmentIsActive({source:"razorpay",status:"revoked",expiresAt:new Date(now+1000)},now),false);
 assert.equal(enrollmentIsActive({source:"admin"},now),true);
});
