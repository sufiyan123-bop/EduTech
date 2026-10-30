import {fail,verifyHmac} from "./core.js";
// Test payments must never be open to arbitrary students. A separate explicit
// mode is required even if the global PAYMENTS_ENABLED switch is flipped.
export function ownerTestMode(env){return env.PAYMENTS_MODE==="owner_test";}
export function paymentConfigured(env){
 const keys=Boolean(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET);
 if(!keys||env.PAYMENTS_ENABLED!=="true")return false;
 if(ownerTestMode(env))return /^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID);
 // A future switch to live keys cannot silently turn on real billing.
 if(env.PAYMENTS_MODE==="live"&&env.LIVE_PAYMENTS_APPROVED==="true")
  return /^rzp_live_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID);
 return false;
}
export function canUseCheckout(env,user){
 if(!paymentConfigured(env))return false;
 if(ownerTestMode(env))return Boolean(user?.staffActive===1&&user?.role==="owner");
 return true;
}
export function requireCheckoutPermission(env,user){
 if(!canUseCheckout(env,user))fail(403,ownerTestMode(env)?"Dummy checkout is currently restricted to the academy owner.":"Checkout is not enabled for this account.");
}
export async function razorpay(env,method,path,body){
 if(!paymentConfigured(env))fail(503,"Payments are not configured");
 const r=await fetch("https://api.razorpay.com/v1"+path,{
  // Razorpay keys are ASCII; strip accidental whitespace introduced by pasting secrets.
  method,headers:{"Authorization":"Basic "+btoa(String(env.RAZORPAY_KEY_ID).trim()+":"+String(env.RAZORPAY_KEY_SECRET).trim()),"Content-Type":"application/json"},
  body:body?JSON.stringify(body):undefined
 });
 if(!r.ok){
  // Razorpay can reject a Live order for reasons other than an API key
  // mismatch (merchant permissions, activation, invalid order fields, etc).
  // Never log credentials or reveal the payment API response wholesale.
  const payload=await r.json().catch(()=>null);
  const apiError=payload?.error;
  const code=typeof apiError?.code==="string"?apiError.code.slice(0,50):"unknown";
  const reason=typeof apiError?.reason==="string"?apiError.reason.slice(0,80):"unknown";
  console.error("Razorpay request failed",{status:r.status,code,reason,operation:method+" "+path.replace(/\/payments\/[^/]+$/,"/payments/:id")});
  if(method==="POST"&&path==="/orders"&&r.status>=400&&r.status<500){
   const message=typeof apiError?.description==="string"
    ?apiError.description.replace(/[\r\n\t]/g," ").replace(/https?:\/\/\S+/gi,"[link]").replace(/rzp_(?:live|test)_[A-Za-z0-9]+/g,"[key]").replace(/[A-Za-z0-9_\-]{40,}/g,"[redacted]").trim().slice(0,170)
    :"";
   fail(503,"Razorpay rejected this live order (HTTP "+r.status+")"+(message?": "+message:". Contact Razorpay support with the HTTP status."));
  }
  fail(503,"Razorpay is unavailable (HTTP "+r.status+"). Please try again or contact support.");
 }
 return r.json();
}
export function calendarMonths(start,months){
 const d=new Date(start),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(last,day));return Math.floor(d.getTime()/1000);
}
export async function captureAndEnroll(env,payment,expectedOrderId){
 if(!payment||payment.order_id!==expectedOrderId||payment.status!=="captured"||payment.currency!=="INR")fail(422,"Payment has not been captured");
 const order=await env.DB.prepare("SELECT * FROM payment_orders WHERE razorpay_order_id=?").bind(expectedOrderId).first();
 if(!order)fail(404,"Payment order not recognized");
 if(ownerTestMode(env)){
  const owner=await env.DB.prepare("SELECT role,active FROM staff WHERE user_id=?").bind(order.user_id).first();
  if(owner?.role!=="owner"||owner?.active!==1)fail(403,"Only the academy owner can receive dummy checkout access");
 }
 if(Number(payment.amount)!==order.amount_paise)fail(422,"Payment amount mismatch");
 if(order.state==="paid"){
  if(order.razorpay_payment_id!==payment.id)fail(409,"Order already paid by another payment");
  return {status:"active",courseId:order.course_id,alreadyProcessed:true};
 }
 if(order.state!=="created")fail(409,"Order is not payable");
 const old=await env.DB.prepare("SELECT expires_at FROM enrollments WHERE user_id=? AND course_id=?").bind(order.user_id,order.course_id).first();
 const now=Math.floor(Date.now()/1000),base=old?.expires_at&&old.expires_at>now?old.expires_at:now;
 const until=calendarMonths(base*1000,order.months);
 // D1 batch executes atomically. Only a 'created' order may add a new enrollment.
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO enrollments(user_id,course_id,source,starts_at,expires_at)
   SELECT user_id,course_id,'razorpay',unixepoch(),? FROM payment_orders
   WHERE razorpay_order_id=? AND state='created'
   ON CONFLICT(user_id,course_id) DO UPDATE SET expires_at=
   CASE WHEN enrollments.expires_at IS NULL THEN NULL ELSE MAX(enrollments.expires_at,excluded.expires_at) END`).bind(until,expectedOrderId),
  env.DB.prepare(`UPDATE payment_orders SET state='paid',razorpay_payment_id=?,verified_at=unixepoch()
   WHERE razorpay_order_id=? AND state='created'`).bind(payment.id,expectedOrderId)
 ]);
 return {status:"active",courseId:order.course_id,expiresAt:new Date(until*1000).toISOString()};
}
