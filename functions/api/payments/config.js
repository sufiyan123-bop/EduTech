import {optionalUser,json,errorResponse} from "../../_lib/core.js";
import {canUseCheckout,ownerTestMode} from "../../_lib/payments.js";
export async function onRequestGet(ctx){
 try{
  const user=await optionalUser(ctx);
  const eligible=canUseCheckout(ctx.env,user);
  return json({configured:eligible,keyId:eligible?ctx.env.RAZORPAY_KEY_ID:null,
   testMode:ownerTestMode(ctx.env),ownerOnly:ownerTestMode(ctx.env)});
 }catch(e){return errorResponse(e)}
}
