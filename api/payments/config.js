import { gatewayConfigured, json } from "../_lib/paymentServer.js";
export function GET(){ return json({configured:gatewayConfigured(),testMode:process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")===true}); }
