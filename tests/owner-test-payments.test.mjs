import test from "node:test";
import assert from "node:assert/strict";
import {canUseCheckout,paymentConfigured,requireCheckoutPermission,captureAndEnroll} from "../functions/_lib/payments.js";
import {onRequestGet as paymentConfig} from "../functions/api/payments/config.js";
import {onRequestPost as createOrder} from "../functions/api/payments/create-order.js";
import {sha256} from "../functions/_lib/core.js";

const testEnv=()=>({
 PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"owner_test",
 RAZORPAY_KEY_ID:"rzp_test_abc123",RAZORPAY_KEY_SECRET:"example-only",RAZORPAY_WEBHOOK_SECRET:"different-example"
});
const owner={id:"owner-1",email:"owner@example.com",role:"owner",staffActive:1};
const student={id:"student-1",email:"student@example.com",role:null,staffActive:null};
const staff={id:"staff-1",email:"staff@example.com",role:"staff",staffActive:1};

test("test Razorpay checkout requires active owner role on the server",()=>{
 const env=testEnv();
 assert.equal(paymentConfigured(env),true);
 assert.equal(canUseCheckout(env,owner),true);
 for(const u of [student,staff,{...owner,staffActive:0},null]){
  assert.equal(canUseCheckout(env,u),false);
  assert.throws(()=>requireCheckoutPermission(env,u),e=>e.status===403);
 }
 assert.doesNotThrow(()=>requireCheckoutPermission(env,owner));
});

test("swapping to live keys cannot silently activate real money checkout",()=>{
 const env=testEnv();
 assert.equal(paymentConfigured({...env,RAZORPAY_KEY_ID:"rzp_live_abc123"}),false);
 assert.equal(paymentConfigured({...env,PAYMENTS_MODE:"live",RAZORPAY_KEY_ID:"rzp_live_abc123"}),false);
 assert.equal(paymentConfigured({...env,PAYMENTS_MODE:"live",RAZORPAY_KEY_ID:"rzp_live_abc123",LIVE_PAYMENTS_APPROVED:"true"}),true);
});

function requestCtx(user){
 const cookie="a".repeat(64);
 const env={...testEnv(),DB:{
  prepare(){return {bind(){return {first:async()=>user}}}}
 }};
 return {env,request:new Request("https://infrarivet.pages.dev/api/payments/config",{headers:{Cookie:"infrarivet_session="+cookie}})};
}

test("payment config hides checkout key and disables button for students",async()=>{
 const a=await paymentConfig(requestCtx(student));
 assert.equal(a.status,200);
 const studentConfig=await a.json();
 assert.equal(studentConfig.configured,false);
 assert.equal(studentConfig.keyId,null);
 assert.equal(studentConfig.ownerOnly,true);
 const b=await paymentConfig(requestCtx(owner));
 const ownerConfig=await b.json();
 assert.equal(ownerConfig.configured,true);
 assert.equal(ownerConfig.keyId,"rzp_test_abc123");
 assert.equal(ownerConfig.testMode,true);
});

test("ordinary student cannot create test order even with forged client request",async()=>{
 const ctx=requestCtx(student);
 ctx.request=new Request("https://infrarivet.pages.dev/api/payments/create-order",{
  method:"POST",headers:{Cookie:"infrarivet_session="+"a".repeat(64),
   Origin:"https://infrarivet.pages.dev","Content-Type":"application/json"},
  body:JSON.stringify({courseId:"course-1",months:1})
 });
 const result=await createOrder(ctx);
 assert.equal(result.status,403);
 assert.match((await result.json()).error,/restricted to the academy owner/);
});

test("webhook never unlocks test purchase if recipient is not active owner",async()=>{
 const db={prepare(sql){return {bind(){return {first:async()=>{
  if(sql.includes("FROM payment_orders"))return {user_id:"student-1",amount_paise:14900,course_id:"course-1",state:"created"};
  if(sql.includes("FROM staff"))return {role:"staff",active:1};
  return null;
 }}}}},batch(){throw Error("must not enroll unauthorized account")}};
 const env={...testEnv(),DB:db};
 const payment={order_id:"order_123",id:"pay_123",status:"captured",currency:"INR",amount:14900};
 await assert.rejects(captureAndEnroll(env,payment,"order_123"),e=>e.status===403);
});
