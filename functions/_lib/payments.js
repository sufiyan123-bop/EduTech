import {fail,verifyHmac} from "./core.js";
export function paymentConfigured(env){return Boolean(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET&&env.PAYMENTS_ENABLED==="true");}
export async function razorpay(env,method,path,body){
 if(!paymentConfigured(env))fail(503,"Payments are not configured");
 const r=await fetch("https://api.razorpay.com/v1"+path,{
  method,headers:{"Authorization":"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET),"Content-Type":"application/json"},
  body:body?JSON.stringify(body):undefined
 });
 if(!r.ok){console.error("Razorpay failed",r.status);fail(503,"Payment provider is temporarily unavailable")}
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
