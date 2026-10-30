import {requireUser,fail,json,errorResponse} from "../../_lib/core.js";

// Read-only connection test for the academy owner. No orders/payments created.
// Do not reveal, log, return or persist any credential, hash or fingerprint.
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);
  if(user.role!=="owner"||user.staffActive!==1)fail(403,"Owner access required");
  const env=ctx.env;
  const id=String(env.RAZORPAY_KEY_ID||"");
  const secret=String(env.RAZORPAY_KEY_SECRET||"");
  const hook=String(env.RAZORPAY_WEBHOOK_SECRET||"");
  const safety={
   mode:env.PAYMENTS_MODE==="live"?"live":"not_live",
   keyIdIsLive:/^rzp_live_[A-Za-z0-9]+$/.test(id),
   keyIdEndsWith:id.slice(-4),
   apiSecretLoaded:secret.length>0,
   apiSecretEqualsWebhookSecret:Boolean(secret&&hook&&secret===hook),
   apiSecretLooksLikeKeyId:/^rzp_(?:test|live)_/.test(secret),
   apiSecretHasEmbeddedWhitespace:/\s/.test(secret.trim()),
   apiSecretHasSurroundingWhitespace:secret.trim()!==secret
  };
  if(!safety.keyIdIsLive||!safety.apiSecretLoaded)
   return json({...safety,authenticated:false,apiHttpStatus:null,diagnosis:"Missing Live Key ID or API Key Secret"});
  let response;
  try{
   response=await fetch("https://api.razorpay.com/v1/orders?count=1",{
    method:"GET",
    headers:{Authorization:"Basic "+btoa(id.trim()+":"+secret.trim()),Accept:"application/json"}
   });
  }catch{
   return json({...safety,authenticated:false,apiHttpStatus:null,diagnosis:"Razorpay network request could not complete"});
  }
  return json({
   ...safety,
   authenticated:response.ok,
   apiHttpStatus:response.status,
   diagnosis:response.ok?"Live credentials accepted":
    response.status===401?"Razorpay rejected Basic Auth credentials (HTTP 401)":
    "Razorpay returned HTTP "+response.status
  });
 }catch(e){return errorResponse(e)}
}
