import test from "node:test";
import assert from "node:assert/strict";
import {razorpay} from "../functions/_lib/payments.js";

const env={
 RAZORPAY_KEY_ID:"rzp_live_sample123",
 RAZORPAY_KEY_SECRET:"not-a-real-secret",
 RAZORPAY_WEBHOOK_SECRET:"webhook-example",
 PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"live",LIVE_PAYMENTS_APPROVED:"true"
};
const originalFetch=globalThis.fetch;

test("Live order rejection returns Razorpay reason without revealing keys",async()=>{
 globalThis.fetch=async (url,opts)=>{
  assert.equal(url,"https://api.razorpay.com/v1/orders");
  assert.equal(opts.method,"POST");
  assert.ok(opts.headers.Authorization.startsWith("Basic "));
  return Response.json({error:{code:"BAD_REQUEST_ERROR",reason:"account_not_activated",description:"Your account is not enabled to create Live orders"}},{status:400});
 };
 try{
  await assert.rejects(razorpay(env,"POST","/orders",{amount:14900,currency:"INR"}),e=>{
   assert.equal(e.status,503);
   assert.match(e.message,/HTTP 400/);
   assert.match(e.message,/account is not enabled/);
   assert.doesNotMatch(e.message,/not-a-real-secret|rzp_live_sample123/);
   return true;
  });
 }finally{globalThis.fetch=originalFetch;}
});

test("Razorpay 401 returns useful status; potentially sensitive text is scrubbed",async()=>{
 globalThis.fetch=async()=>Response.json({error:{code:"BAD_REQUEST_ERROR",description:"The API rzp_live_sample123 cannot work. https://example.com/path"}},{status:401});
 try{
  await assert.rejects(razorpay(env,"POST","/orders",{amount:14900}),e=>{
   assert.match(e.message,/HTTP 401/);
   assert.doesNotMatch(e.message,/rzp_live_sample123|https:\/\//);
   return true;
  });
 }finally{globalThis.fetch=originalFetch;}
});

test("Razorpay server failure is generic even with private provider details",async()=>{
 globalThis.fetch=async()=>Response.json({error:{description:"Private provider incident details"}},{status:502});
 try{
  await assert.rejects(razorpay(env,"POST","/orders",{amount:14900}),e=>{
   assert.match(e.message,/HTTP 502/);
   assert.doesNotMatch(e.message,/Private provider/);
   return true;
  });
 }finally{globalThis.fetch=originalFetch;}
});

test("Successful order API response remains unchanged",async()=>{
 const order={id:"order_abc",amount:14900,currency:"INR"};
 globalThis.fetch=async()=>Response.json(order);
 try{assert.deepEqual(await razorpay(env,"POST","/orders",{amount:14900}),order);}
 finally{globalThis.fetch=originalFetch;}
});
