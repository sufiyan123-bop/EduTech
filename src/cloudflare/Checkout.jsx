import {useEffect,useState} from "react";
import {useNavigate,Link} from "react-router-dom";
import {useAuth} from "./Auth.jsx";
import {api,formatPrice} from "./api.js";
import {ArrowRight,ShieldCheck} from "lucide-react";
let promise;
function loadRazorpay(){
 if(window.Razorpay)return Promise.resolve();
 if(!promise)promise=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://checkout.razorpay.com/v1/checkout.js";script.onload=resolve;script.onerror=()=>{promise=null;reject(Error("Checkout failed to load"))};document.head.appendChild(script)});
 return promise;
}
export default function Checkout({course}){
 const {user}=useAuth(),nav=useNavigate(),[config,setConfig]=useState(null),[months,setMonths]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{api("/api/payments/config").then(setConfig).catch(()=>setConfig({configured:false}))},[]);
 const plans=[1,3,6,12].map(m=>{const v=course.plans?.[String(m)],price=Number(typeof v==="object"&&v!==null?v.price:v);return {months:m,price}}).filter(x=>Number.isSafeInteger(x.price)&&x.price>0);
 const selected=plans.find(x=>x.months===months)||plans[0];
 useEffect(()=>{if(plans.length&&!plans.some(p=>p.months===months))setMonths(plans[0].months)},[course.id]);
 async function pay(){
  if(!user||!selected||!config?.configured)return;
  setBusy(true);setError("");setMessage("");
  try{
   await loadRazorpay();
   const order=await api("/api/payments/create-order",{method:"POST",body:{courseId:course.id,months:selected.months}});
   const checkout=new window.Razorpay({key:order.keyId,order_id:order.orderId,currency:"INR",amount:order.amount,name:"InfraRivet Academy",description:course.title,prefill:{email:user.email},modal:{ondismiss:()=>setBusy(false)},handler:async payment=>{
    setMessage("Verifying your payment...");
    try{
     const result=await api("/api/payments/verify",{method:"POST",body:payment});
     if(result.status==="active")nav("/learn/"+encodeURIComponent(course.id));else setMessage("Payment is processing. Check your dashboard.");
    }catch(e){setError(e.message+" If payment was deducted, please do not pay again until verified.")}finally{setBusy(false)}
   }});
   checkout.on("payment.failed",()=>setError("Payment failed. Please check the payment method."));checkout.open();
  }catch(e){setError(e.message);setBusy(false)}
 }
 return <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-sm font-extrabold text-slate-900">Choose an access plan</p>{plans.length?<div className="mt-3 grid grid-cols-2 gap-2">{plans.map(p=><button key={p.months} onClick={()=>setMonths(p.months)} className={"rounded-xl border p-3 text-left "+(selected?.months===p.months?"border-blue-700 bg-blue-50":"border-slate-200")}><span className="block text-xs text-slate-500">{p.months} {p.months===1?"month":"months"}</span><strong className="mt-1 block text-lg">{formatPrice(p.price)}</strong></button>)}</div>:<p className="mt-3 text-sm text-slate-600">Access plans will be available soon.</p>}{!user?<Link to="/login" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Sign in to enroll <ArrowRight size={17}/></Link>:<button disabled={!plans.length||!config?.configured||busy} onClick={pay} className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-3 font-extrabold text-white disabled:opacity-50">{busy?"Processing...":!config?.configured?(config?.ownerOnly?"Owner-only test checkout":"Payment setup pending"):selected?(config?.testMode?"TEST PAY "+formatPrice(selected.price)+" (dummy)":"Pay "+formatPrice(selected.price)+" securely"):"Choose a plan"}</button>}{config?.ownerOnly&&!config?.configured&&<p className="mt-2 text-xs font-semibold text-amber-700">Dummy checkout is temporarily available only to the Academy owner. Students cannot make test purchases.</p>}{config?.testMode&&<p className="mt-2 text-xs font-semibold text-amber-700">Razorpay Test Mode — dummy transaction only; no real money is charged.</p>}{message&&<p role="status" className="mt-3 text-sm text-blue-800">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> Purchase unlocks all included courses for the plan duration.</p></div>;
}
