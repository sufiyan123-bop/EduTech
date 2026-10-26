import { database, authenticatedUid, razorpayApi, gatewayConfigured, json, errorResponse, httpError } from "../_lib/paymentServer.js";
import { PLAN_MONTHS, planPriceInPaise } from "../../src/utils/paymentPlans.js";
import { FieldValue } from "firebase-admin/firestore";
export async function POST(request){
 try{
  if(!gatewayConfigured())throw httpError(503,"Checkout is not configured yet. Please contact support.");
  const uid=await authenticatedUid(request);
  const input=await request.json().catch(()=>({}));
  const courseId=String(input.courseId||""),months=Number(input.months);
  if(!/^[\w-]{1,150}$/.test(courseId)||!PLAN_MONTHS.includes(months))throw httpError(400,"Select a valid course and access plan.");
  const db=database(),snapshot=await db.collection("courses").doc(courseId).get();
  if(!snapshot.exists)throw httpError(404,"Course not found.");
  const course=snapshot.data();
  if(course.published!==true||course.status==="comingSoon"||course.folderOnly===true||(course.includedInCourseIds||[]).length>0||Number(course.price)<=0)throw httpError(400,"This course is not available for online purchase.");
  const amountPaise=planPriceInPaise(course,months);
  if(!amountPaise)throw httpError(400,"The selected plan is not configured. Ask the administrator to add its price.");
  const razorpayOrder=await razorpayApi("POST","/orders",{amount:amountPaise,currency:"INR",receipt:uid.slice(0,12)+"_"+Date.now().toString(36),notes:{courseId,userId:uid,planMonths:String(months)}});
  if(!razorpayOrder.id||Number(razorpayOrder.amount)!==amountPaise||razorpayOrder.currency!=="INR")throw httpError(503,"Invalid payment order returned.");
  await db.collection("paymentOrders").doc(razorpayOrder.id).create({
   provider:"razorpay",providerOrderId:razorpayOrder.id,userId:uid,courseId,planMonths:months,
   amountPaise,currency:"INR",status:"created",createdAt:FieldValue.serverTimestamp()
  });
  return json({keyId:process.env.RAZORPAY_KEY_ID,orderId:razorpayOrder.id,amount:amountPaise,currency:"INR",months,title:course.title||"EduTech course"});
 }catch(e){return errorResponse(e);}
}
