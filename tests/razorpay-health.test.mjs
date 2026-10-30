import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet} from "../functions/api/admin/razorpay-health.js";
const originalFetch=globalThis.fetch;
const secret="example-live-secret-only-for-tests";
const cookie="a".repeat(64);
const makeCtx=(role="owner",overrides={})=>({
 request:new Request("https://infrarivet.pages.dev/api/admin/razorpay-health",{
  headers:{Cookie:"infrarivet_session="+cookie}
 }),
 env:{
  DB:{prepare:()=>({bind:()=>({first:async()=>({role,staffActive:1,id:"admin",
   email:"admin@example.com",permissionsJson:"[]"})})})},
  RAZORPAY_KEY_ID:"rzp_live_testing123",RAZORPAY_KEY_SECRET:secret,
  RAZORPAY_WEBHOOK_SECRET:"webhook-only-test",
  PAYMENTS_MODE:"live",PAYMENTS_ENABLED:"true",
  ...overrides
 }
});
test("Authenticated owner can test the Live key pair read-only",async()=>{
 globalThis.fetch=async(url,opts)=>{
  assert.equal(url,"https://api.razorpay.com/v1/orders?count=1");
  assert.equal(opts.method,"GET");
  assert.equal(Buffer.from(opts.headers.Authorization.slice(6),"base64").toString("utf8"),
   "rzp_live_testing123:"+secret);
  return Response.json({entity:"collection",items:[]});
 };
 try{
  const response=await onRequestGet(makeCtx());
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.authenticated,true);
  assert.equal(data.apiHttpStatus,200);
  assert.equal(data.apiSecretLoaded,true);
  assert.equal(data.apiSecretEqualsWebhookSecret,false);
  assert.equal(JSON.stringify(data).includes(secret),false);
  assert.equal(JSON.stringify(data).includes("webhook-only-test"),false);
 }finally{globalThis.fetch=originalFetch;}
});
test("Owner sees safe 401 classification without credentials",async()=>{
 globalThis.fetch=async()=>Response.json({error:{description:"Authentication failed"}},{status:401});
 try{
  const r=await onRequestGet(makeCtx());const j=await r.json();
  assert.equal(j.apiHttpStatus,401);assert.equal(j.authenticated,false);
  assert.match(j.diagnosis,/rejected Basic Auth/);
  assert.equal(JSON.stringify(j).includes(secret),false);
 }finally{globalThis.fetch=originalFetch;}
});
test("Detects accidentally pasted webhook secret as API secret",async()=>{
 const r=await onRequestGet(makeCtx("owner",{
  RAZORPAY_KEY_SECRET:"same-secret",RAZORPAY_WEBHOOK_SECRET:"same-secret"
 }));
 const d=await r.json();assert.equal(d.apiSecretEqualsWebhookSecret,true);
});
test("Staff cannot access credential diagnostics",async()=>{
 let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error("must not fetch");};
 try{
  const r=await onRequestGet(makeCtx("staff"));assert.equal(r.status,403);
  assert.equal(fetched,false);
 }finally{globalThis.fetch=originalFetch;}
});
test("Unauthenticated users cannot access diagnostics",async()=>{
 const ctx=makeCtx();ctx.request=new Request("https://infrarivet.pages.dev/api/admin/razorpay-health");
 const r=await onRequestGet(ctx);assert.equal(r.status,401);
});
