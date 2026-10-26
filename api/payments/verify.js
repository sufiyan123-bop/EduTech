import { database, authenticatedUid, razorpayApi, gatewayConfigured, json, errorResponse, httpError, fulfillCapturedPayment } from "../_lib/paymentServer.js";
import { checkoutSignatureMatches } from "../_lib/signatures.js";
export async function POST(request){
 try{
  if(!gatewayConfigured())throw httpError(503,"Checkout is not configured yet.");
  const uid=await authenticatedUid(request);
  const input=await request.json().catch(()=>({}));
  const orderId=String(input.razorpay_order_id||""),paymentId=String(input.razorpay_payment_id||""),signature=String(input.razorpay_signature||"");
  if(!/^order_[\w-]{6,80}$/.test(orderId)||!/^pay_[\w-]{6,80}$/.test(paymentId))throw httpError(400,"Invalid payment details.");
  const order=await database().collection("paymentOrders").doc(orderId).get();
  if(!order.exists||order.data().userId!==uid)throw httpError(403,"Payment does not belong to this account.");
  if(!checkoutSignatureMatches(order.id,paymentId,signature,process.env.RAZORPAY_KEY_SECRET))throw httpError(403,"Invalid payment signature.");
  const payment=await razorpayApi("GET","/payments/"+encodeURIComponent(paymentId));
  if(payment.order_id!==order.id)throw httpError(422,"Payment was not made for this order.");
  if(payment.status!=="captured")return json({status:"pending",message:"Payment is processing. Access will activate after payment capture is confirmed."});
  const result=await fulfillCapturedPayment(payment,order.id);
  return json(result);
 }catch(e){return errorResponse(e);}
}
