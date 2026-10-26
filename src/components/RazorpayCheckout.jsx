import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../services/AuthProvider.jsx";
import { PLAN_MONTHS, planPriceInPaise } from "../utils/paymentPlans.js";

let scriptPromise;
function loadCheckout() {
 if (window.Razorpay) return Promise.resolve();
 if (!scriptPromise) scriptPromise = new Promise((resolve,reject)=>{
  const s=document.createElement("script");
  s.src="https://checkout.razorpay.com/v1/checkout.js";
  s.onload=()=>window.Razorpay?resolve():(scriptPromise=null,reject(Error("Checkout did not initialize.")));
  s.onerror=()=>{scriptPromise=null;reject(Error("Checkout script failed to load."));};
  document.head.appendChild(s);
 });
 return scriptPromise;
}
async function post(url,user,data) {
 const token=await user.getIdToken();
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(data)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||"Payment request failed.");
 return result;
}
export default function RazorpayCheckout({course}) {
 const {user}=useAuth(),navigate=useNavigate();
 const plans=PLAN_MONTHS.map(months=>({months,amount:planPriceInPaise(course,months)})).filter(p=>p.amount);
 const [months,setMonths]=useState(1),[config,setConfig]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{setMonths(plans[0]?.months||1)},[course?.id]);
 useEffect(()=>{let active=true;fetch("/api/payments/config").then(r=>r.ok?r.json():Promise.reject()).then(r=>{if(active)setConfig(r)}).catch(()=>{if(active)setConfig({configured:false})});return()=>{active=false}},[]);
 const selected=plans.find(p=>p.months===months)||plans[0];
 async function buy(){
  if(!user||!selected||!config?.configured||busy)return;
  setBusy(true);setMessage("");setError("");
  try {
   await loadCheckout();
   const order=await post("/api/payments/create-order",user,{courseId:course.id,months:selected.months});
   const instance=new window.Razorpay({key:order.keyId,amount:order.amount,currency:"INR",order_id:order.orderId,name:"EduTech",description:course.title+" / "+selected.months+" months",prefill:{email:user.email||""},modal:{ondismiss:()=>setBusy(false)},handler:async payment=>{
    setBusy(true);setMessage("Verifying payment...");
    try{
     const result=await post("/api/payments/verify",user,payment);
     if(result.status==="active")navigate("/learn/"+encodeURIComponent(course.id));
     else setMessage("Payment processing. Your course will unlock automatically after confirmation.");
    }catch(e){setError(e.message+" If money was deducted, do not pay again until checking the status.");}
    finally{setBusy(false)}
   }});
   instance.on("payment.failed",()=>{setError("Payment failed. You can retry inside Razorpay Checkout or close it.");});
   instance.open();
  }catch(e){setError(e.message||"Checkout unavailable.");setBusy(false)}
 }
 if(!plans.length)return <p className="mt-5 text-sm text-amber-800">Course plans have not been priced yet. Contact the administrator.</p>;
 return <section className="mt-6 border-t pt-6"><h3 className="font-bold">Choose your access plan</h3><div className="mt-3 grid grid-cols-2 gap-2">{plans.map(p=><button type="button" aria-pressed={selected?.months===p.months} key={p.months} onClick={()=>setMonths(p.months)} className={"rounded-xl border p-3 text-left "+(selected?.months===p.months?"border-blue-700 bg-blue-50":"border-slate-200")}><span className="block text-xs">{p.months} {p.months===1?"month":"months"}</span><strong className="block text-lg">₹{(p.amount/100).toLocaleString("en-IN")}</strong></button>)}</div><p className="mt-3 text-xs text-slate-600">One-time payment. No automatic renewal.</p>{!user?<Link to="/login" className="mt-4 block rounded-xl bg-blue-700 p-3 text-center font-bold text-white">Sign in to purchase</Link>:<button type="button" onClick={buy} disabled={!config?.configured||busy} className="mt-4 w-full rounded-xl bg-blue-700 p-3 font-bold text-white disabled:opacity-50">{busy?"Processing…":!config?.configured?"Payment setup pending":"Pay ₹"+(selected?.amount/100).toLocaleString("en-IN")+" securely"}</button>}{config?.testMode&&<p className="mt-2 text-xs font-bold text-amber-800">Test mode — no real money charged</p>}{config?.configured===false&&<p className="mt-2 text-xs text-amber-800">Razorpay merchant configuration is pending.</p>}{message&&<p role="status" className="mt-3 text-sm text-blue-800">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>;
}
