import { database, razorpayApi, gatewayConfigured, json, errorResponse, httpError, fulfillCapturedPayment } from "../_lib/paymentServer.js";
import { webhookSignatureMatches } from "../_lib/signatures.js";
// Opening the endpoint in a browser is a GET; actual Razorpay delivery uses signed POST.
export function GET(){
 return json({
  endpoint:"InfraRivet Academy Razorpay webhook",
  status:"available",
  configured:gatewayConfigured(),
  note:"This is a machine-to-machine endpoint. Razorpay must send a signed POST; opening this URL in a browser does not test payment delivery.",
  acceptedEvent:"payment.captured"
 });
}
export async function POST(request){
 try{
  if(!gatewayConfigured())throw httpError(503,"Webhook is not configured.");
  const bytes=Buffer.from(await request.arrayBuffer());
  if(bytes.length>256000)throw httpError(400,"Webhook body too large.");
  const signature=request.headers.get("x-razorpay-signature")||"";
  if(!webhookSignatureMatches(bytes,signature,process.env.RAZORPAY_WEBHOOK_SECRET))throw httpError(403,"Invalid webhook signature.");
  let event;try{event=JSON.parse(bytes.toString("utf8"));}catch{throw httpError(400,"Invalid webhook JSON.");}
  if(!["payment.captured","order.paid"].includes(event.event))return json({status:"ignored"});
  let payment=event.payload?.payment?.entity;
  if(!payment?.id||!payment?.order_id)return json({status:"ignored",reason:"no payment in event"});
  // Fetch live status; webhook snapshot can be older than latest payment state.
  payment=await razorpayApi("GET","/payments/"+encodeURIComponent(payment.id));
  if(payment.status!=="captured")return json({status:"pending"});
  await fulfillCapturedPayment(payment,payment.order_id);
  return json({status:"ok"});
 }catch(e){
  if(e.status===404){ // Unknown order must retry; order record may be in flight.
   return Response.json({error:e.message},{status:503});
  }
  return errorResponse(e);
 }
}
