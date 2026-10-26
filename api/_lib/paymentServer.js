import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { addCalendarMonths } from "../../src/utils/paymentPlans.js";

export function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
export function errorResponse(error) {
 const status = [400,401,403,404,405,409,422,503].includes(error?.status) ? error.status : 500;
 if (status === 500) console.error("Payment service error:", error);
 return Response.json({error:status === 500 ? "Payment service temporarily unavailable." : error.message},{status,headers:{"Cache-Control":"no-store"}});
}
export function json(data, status=200) { return Response.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
export function gatewayConfigured() { return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET && (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY))); }
function initializeFirebase(){
 if (getApps().length) return;
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 let account;
 try {
   if(raw) account=JSON.parse(raw);
   else if(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY){
     account={projectId:process.env.FIREBASE_PROJECT_ID||process.env.VITE_FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")};
   }
 }catch{throw httpError(503,"Firebase service credentials are not configured correctly.");}
 if(!account) throw httpError(503,"Firebase service credentials are missing.");
 initializeApp({credential:cert(account)});
}
export function database(){initializeFirebase();return getFirestore();}
export async function authenticatedUid(request){
 initializeFirebase();
 const auth=request.headers.get("authorization")||"";
 const token=/^Bearer (\S+)$/i.exec(auth)?.[1];
 if(!token)throw httpError(401,"Sign in to purchase a course.");
 try {const verified=await getAuth().verifyIdToken(token,true);return verified.uid;}
 catch{throw httpError(401,"Session expired. Please sign in again.");}
}
export async function razorpayApi(method,path,payload){
 const key=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;
 if(!key||!secret)throw httpError(503,"Razorpay credentials are not configured.");
 const authorization=Buffer.from(key+":"+secret).toString("base64");
 let response;
 try {
  response=await fetch("https://api.razorpay.com/v1"+path,{method,headers:{"Authorization":"Basic "+authorization,"Content-Type":"application/json"},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});
 }catch{throw httpError(503,"Unable to contact the payment provider.");}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){console.error("Razorpay API failure",response.status,data?.error?.code);throw httpError(503,"Payment provider rejected this request. Please try again.");}
 return data;
}
export async function fulfillCapturedPayment(payment, expectedOrderId){
 if(!payment?.id||!payment?.order_id||payment.order_id!==expectedOrderId||payment.status!=="captured")throw httpError(422,"Payment is not captured yet.");
 const db=database();
 const orderRef=db.collection("paymentOrders").doc(expectedOrderId);
 const processedRef=db.collection("paymentFulfillments").doc(payment.id);
 return db.runTransaction(async tx=>{
  const orderSnap=await tx.get(orderRef);
  const processedSnap=await tx.get(processedRef);
  if(!orderSnap.exists)throw httpError(404,"Unrecognized payment order.");
  const order=orderSnap.data();
  if(order.provider!=="razorpay"||order.currency!=="INR"||order.providerOrderId!==expectedOrderId || order.amountPaise!==Number(payment.amount) || payment.currency!==order.currency) throw httpError(422,"Payment amount or order did not match.");
  if(processedSnap.exists){
   const existing=db.collection("enrollments").doc(order.userId+"_"+order.courseId);
   const enrolled=await tx.get(existing);
   return {status:"active",alreadyProcessed:true,expiresAt:enrolled.data()?.expiresAt?.toDate?.()?.toISOString()||null,courseId:order.courseId};
  }
  if(order.status==="paid")throw httpError(409,"This order has already been fulfilled.");
  const enrollmentRef=db.collection("enrollments").doc(order.userId+"_"+order.courseId);
  const existing=await tx.get(enrollmentRef);
  const now=new Date(),previous=existing.data();
  const previousExpiry=previous?.expiresAt?.toDate?.();
  const base=previousExpiry instanceof Date&&previousExpiry>now?previousExpiry:now;
  const expiresAt=addCalendarMonths(base,order.planMonths);
  const updated={
   userId:order.userId,courseId:order.courseId,source:"razorpay",status:"active",planMonths:order.planMonths,
   startsAt:previous?.startsAt||Timestamp.fromDate(now),expiresAt:Timestamp.fromDate(expiresAt),
   providerOrderId:expectedOrderId,providerPaymentId:payment.id,updatedAt:FieldValue.serverTimestamp()
  };
  tx.set(enrollmentRef,updated,{merge:true});
  tx.create(processedRef,{userId:order.userId,courseId:order.courseId,orderId:expectedOrderId,paymentId:payment.id,createdAt:FieldValue.serverTimestamp()});
  tx.update(orderRef,{status:"paid",providerPaymentId:payment.id,paidAt:FieldValue.serverTimestamp()});
  return {status:"active",courseId:order.courseId,expiresAt:expiresAt.toISOString()};
 });
}
