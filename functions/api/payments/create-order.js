import {requireUser,checkOrigin,bodyJson,fail,json,errorResponse} from "../../_lib/core.js";
import {razorpay,paymentConfigured,requireCheckoutPermission} from "../../_lib/payments.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);
  if(!paymentConfigured(ctx.env))fail(503,"Payments are not configured");
  requireCheckoutPermission(ctx.env,user);
  const body=await bodyJson(ctx.request),id=String(body.courseId||""),months=Number(body.months);
  if(![1,3,6,12].includes(months))fail(400,"Invalid plan duration");
  const course=await ctx.env.DB.prepare("SELECT id,title,status,published,details_json FROM courses WHERE id=?").bind(id).first();
  if(!course||!course.published||course.status==="comingSoon")fail(404,"Course not available");
  const details=JSON.parse(course.details_json||"{}");
  if(details.folderOnly)fail(400,"Only the main course can be purchased.");
  // A standalone published course stays independently purchasable even when
  // included in DevOps or other master programs; no duplicate videos or orders.
  // However, prevent charging somebody for a child they already receive from
  // an active master-course enrollment.
  const bundleAccess=await ctx.env.DB.prepare(`SELECT p.title AS parentTitle
    FROM course_inclusions i JOIN enrollments e ON e.course_id=i.parent_course_id
    JOIN courses p ON p.id=i.parent_course_id
    WHERE i.child_course_id=? AND e.user_id=?
      AND (e.expires_at IS NULL OR e.expires_at>unixepoch())
    LIMIT 1`).bind(id,user.id).first();
  if(bundleAccess)fail(409,"You already have access through "+bundleAccess.parentTitle+".");
  const existing=await ctx.env.DB.prepare("SELECT source FROM enrollments WHERE user_id=? AND course_id=? AND (expires_at IS NULL OR expires_at>unixepoch())").bind(user.id,id).first();
  if(existing?.source==="admin")fail(409,"You already have access to this course.");
  const plans=details.plans||{};
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
