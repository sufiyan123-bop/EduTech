import {verifyHmac,json,fail,errorResponse} from "../../_lib/core.js";
import {razorpay,captureAndEnroll,paymentConfigured} from "../../_lib/payments.js";
export async function onRequestPost(ctx){
 try{
  if(!paymentConfigured(ctx.env))fail(503,"Payments not configured");
  const raw=await ctx.request.text(),signature=ctx.request.headers.get("X-Razorpay-Signature");
  if(raw.length>500000)fail(413,"Webhook too large");
  if(!await verifyHmac(ctx.env.RAZORPAY_WEBHOOK_SECRET,raw,signature))fail(403,"Invalid webhook signature");
  let event;try{event=JSON.parse(raw)}catch{fail(400,"Invalid webhook payload")}
  if(event.event!=="payment.captured")return json({received:true,ignored:true});
  const obj=event.payload?.payment?.entity;
  if(!obj?.id||!obj?.order_id)fail(422,"Malformed payment event");
  // Fetch the authoritative payment state rather than trusting callback fields.
  const payment=await razorpay(ctx.env,"GET","/payments/"+encodeURIComponent(obj.id));
  await captureAndEnroll(ctx.env,payment,obj.order_id);
  return json({received:true});
 }catch(e){return errorResponse(e)}
}
