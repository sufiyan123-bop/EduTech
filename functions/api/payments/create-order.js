import {requireUser,checkOrigin,bodyJson,fail,json,errorResponse} from "../../_lib/core.js";
import {razorpay,paymentConfigured} from "../../_lib/payments.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);
  if(!paymentConfigured(ctx.env))fail(503,"Payments are not configured");
  const body=await bodyJson(ctx.request),id=String(body.courseId||""),months=Number(body.months);
  if(![1,3,6,12].includes(months))fail(400,"Invalid plan duration");
  const course=await ctx.env.DB.prepare("SELECT id,title,status,published,details_json FROM courses WHERE id=?").bind(id).first();
  if(!course||!course.published||course.status==="comingSoon")fail(404,"Course not available");
  const plans=JSON.parse(course.details_json||"{}").plans||{};
  const raw=plans[String(months)];
  const inr=Number(raw&&typeof raw==="object"?raw.price:raw);
  if(!Number.isSafeInteger(inr)||inr<=0||inr>10000000)fail(400,"This access plan is not available");
  const amount=inr*100,internalId=crypto.randomUUID();
  const order=await razorpay(ctx.env,"POST","/orders",{amount,currency:"INR",receipt:internalId,notes:{courseId:id,months:String(months)}});
  if(!order.id||order.amount!==amount||order.currency!=="INR")fail(503,"Payment order not initialized");
  await ctx.env.DB.prepare(`INSERT INTO payment_orders(id,user_id,course_id,razorpay_order_id,amount_paise,months)
   VALUES(?,?,?,?,?,?)`).bind(internalId,user.id,id,order.id,amount,months).run();
  return json({orderId:order.id,keyId:ctx.env.RAZORPAY_KEY_ID,amount,currency:"INR"});
 }catch(e){return errorResponse(e)}
}
