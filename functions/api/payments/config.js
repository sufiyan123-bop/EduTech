import {json} from "../../_lib/core.js";
import {paymentConfigured} from "../../_lib/payments.js";
export async function onRequestGet({env}){return json({configured:paymentConfigured(env),keyId:paymentConfigured(env)?env.RAZORPAY_KEY_ID:null,testMode:Boolean(env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))})}
