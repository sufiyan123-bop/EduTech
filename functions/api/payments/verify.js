import {requireUser,checkOrigin,bodyJson,verifyHmac,fail,json,errorResponse} from "../../_lib/core.js";
import {razorpay,paymentConfigured,captureAndEnroll,requireCheckoutPermission} from "../../_lib/payments.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);
  if(!paymentConfigured(ctx.env))fail(503,"Payments not configured");
  requireCheckoutPermission(ctx.env,user);
  const d=await bodyJson(ctx.request),orderId=String(d.razorpay_order_id||""),paymentId=String(d.razorpay_payment_id||"");
  if(!/^order_[\w-]+$/.test(orderId)||!/^pay_[\w-]+$/.test(paymentId))fail(400,"Invalid payment identifiers");
  if(!await verifyHmac(ctx.env.RAZORPAY_KEY_SECRET,orderId+"|"+paymentId,d.razorpay_signature))fail(403,"Payment signature invalid");
  const order=await ctx.env.DB.prepare("SELECT user_id FROM payment_orders WHERE razorpay_order_id=?").bind(orderId).first();
  if(!order||order.user_id!==user.id)fail(403,"Payment does not belong to this student");
  const payment=await razorpay(ctx.env,"GET","/payments/"+encodeURIComponent(paymentId));
  return json(await captureAndEnroll(ctx.env,payment,orderId));
 }catch(e){return errorResponse(e)}
}
