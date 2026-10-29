import {createContext,useContext,useEffect,useRef,useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {api} from "./api.js";
import {ArrowRight,KeyRound,Mail,ShieldCheck} from "lucide-react";
const AuthContext=createContext({user:null,loading:true});
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;api("/api/auth/me").then(d=>{if(active)setUser(d.user)}).catch(()=>{}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function signOut(){await api("/api/auth/logout",{method:"POST"});setUser(null)}
 return <AuthContext.Provider value={{user,loading,setUser,signOut}}>{children}</AuthContext.Provider>;
}
function TurnstileBox({onToken}){
 const div=useRef(null),widget=useRef(null);
 const [runtimeSiteKey,setRuntimeSiteKey]=useState("");
 const [checkingConfig,setCheckingConfig]=useState(!import.meta.env.VITE_TURNSTILE_SITE_KEY);
 const siteKey=import.meta.env.VITE_TURNSTILE_SITE_KEY || runtimeSiteKey;
 // Pages build variables may be absent even when the site key is set for Functions.
 useEffect(()=>{
  if(import.meta.env.VITE_TURNSTILE_SITE_KEY)return;
  let active=true;
  fetch("/api/public-config",{cache:"no-store"})
   .then(r=>r.ok?r.json():null)
   .then(d=>{if(active&&d?.turnstileSiteKey)setRuntimeSiteKey(d.turnstileSiteKey)})
   .catch(()=>{})
   .finally(()=>{if(active)setCheckingConfig(false)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!siteKey)return;
  let active=true;const script=document.createElement("script");
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
  const display=()=>{if(active&&div.current&&window.turnstile&&widget.current===null){
   widget.current=window.turnstile.render(div.current,{sitekey:siteKey,callback:onToken,"expired-callback":()=>onToken(""),"error-callback":()=>onToken("")});
  }};
  script.addEventListener("load",display);
  if(window.turnstile)display();else document.head.appendChild(script);
  return()=>{active=false;try{if(widget.current!==null)window.turnstile?.remove(widget.current)}catch{};script.remove()}
 },[siteKey]);
 return <div>{siteKey?<div ref={div} className="min-h-16"/>:<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{checkingConfig?"Loading secure login check...":"Secure login is pending Cloudflare Turnstile configuration."}</p>}</div>;
}

function GoogleLoginButton({onSuccess,onFailure}){
 const root=useRef(null),callbacks=useRef({onSuccess,onFailure});
 const [available,setAvailable]=useState(false),[feedback,setFeedback]=useState("Loading Google sign-in...");
 useEffect(()=>{callbacks.current={onSuccess,onFailure}},[onSuccess,onFailure]);
 useEffect(()=>{
  let active=true;let script=null;
  async function init(){
   try{
    const res=await fetch("/api/public-config",{cache:"no-store"});
    if(!res.ok)throw Error("Config unavailable");
    const config=await res.json();
    const clientId=config.googleClientId;
    if(!clientId){setFeedback("Google sign-in is not configured on this website.");return;}
    if(!root.current)return;
    setFeedback("Preparing Google login...");
    const loaded=()=>{if(!active||!root.current||!window.google?.accounts?.id)return;
      window.google.accounts.id.initialize({client_id:clientId,callback:response=>{
        if(!response?.credential)return callbacks.current.onFailure("Google sign-in was cancelled. Please try again.");
        Promise.resolve(callbacks.current.onSuccess(response.credential)).catch(err=>callbacks.current.onFailure(err.message||"Unable to sign in with Google."));
      },ux_mode:"popup",auto_select:false});
      window.google.accounts.id.renderButton(root.current,{theme:"outline",size:"large",text:"continue_with",shape:"pill",width:300});
      setAvailable(true);
    };
    if(window.google?.accounts?.id)loaded();
    else{
      script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";
      script.async=true;script.defer=true;script.onload=loaded;
      script.onerror=()=>{if(active){setAvailable(false);setFeedback("Google login could not load. Open the website in Chrome and refresh.")}};
      document.head.appendChild(script);
    }
   }catch{if(active){setAvailable(false);setFeedback("Could not load Google login settings. Refresh the page.")}}
  }
  init();
  return()=>{active=false;script?.remove();if(root.current)root.current.innerHTML=""};
 },[]);
 return <div className="mb-5"><p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Sign in securely with Google</p><div ref={root} className="flex justify-center"/>{!available&&<p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">{feedback}</p>}</div>;
}

export function Login({signup=false}){
 const {setUser}=useAuth(),navigate=useNavigate();
 const [email,setEmail]=useState(""),[name,setName]=useState(""),[code,setCode]=useState(""),[phase,setPhase]=useState("email"),[token,setToken]=useState(""),[captchaNonce,setCaptchaNonce]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [emailLoginAvailable,setEmailLoginAvailable]=useState(null);
 useEffect(()=>{
  let active=true;
  fetch("/api/public-config",{cache:"no-store"}).then(r=>r.ok?r.json():null)
   .then(config=>{if(active)setEmailLoginAvailable(Boolean(config?.emailLoginEnabled))})
   .catch(()=>{if(active)setEmailLoginAvailable(false)});
  return()=>{active=false};
 },[]);
 async function submit(e){
  e.preventDefault();setError("");setMessage("");setBusy(true);
  try{
   if(phase==="email"){
    const result=await api("/api/auth/request",{method:"POST",body:{email,turnstileToken:token}});
    setPhase("code");setMessage(result.message||"Check your email for the code");
   }else{
    await api("/api/auth/verify",{method:"POST",body:{email,code,name}});
    const me=await api("/api/auth/me");setUser(me.user);navigate(me.user?.role?"/admin":"/dashboard",{replace:true});
   }
  }catch(e){setError(e.message)}finally{if(phase==="email"){setToken("");setCaptchaNonce(n=>n+1)}setBusy(false)}
 }
 async function googleSignIn(credential){
  setError("");setMessage("");setBusy(true);
  try {
   await api("/api/auth/google",{method:"POST",body:{credential}});
   const me=await api("/api/auth/me");
   if(!me.user)throw new Error("Could not load your student session.");
   setUser(me.user);navigate(me.user.role?"/admin":"/dashboard",{replace:true});
  } finally {setBusy(false)}
 }
 return <div className="min-h-[75vh] bg-slate-50 px-5 py-16"><div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><div className="bg-gradient-to-br from-slate-950 to-blue-800 px-7 py-9 text-white"><div className="mb-4 inline-flex rounded-xl bg-white/10 p-3"><KeyRound/></div><h1 className="text-3xl font-extrabold">{signup?"Join InfraRivet Academy":"Welcome back"}</h1><p className="mt-2 text-sm text-slate-200">Secure Google login — no password needed.</p></div><form onSubmit={submit} className="space-y-5 p-7"><GoogleLoginButton onSuccess={googleSignIn} onFailure={setError}/>{error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}{emailLoginAvailable===null?<p role="status" className="text-center text-sm text-slate-500">Checking login methods...</p>:emailLoginAvailable?<>{phase==="email"?<>{signup&&<label className="block text-sm font-semibold">Your name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border p-3"/></label>}<label className="block text-sm font-semibold">Email address<div className="mt-2 flex items-center gap-2 rounded-xl border px-3"><Mail size={18} className="text-slate-400"/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="w-full py-3 outline-none"/></div></label><TurnstileBox key={captchaNonce} onToken={setToken}/></>:<><p className="text-sm text-slate-600">We've sent a code to <strong>{email}</strong>.</p><label className="block text-sm font-semibold">6-digit verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="mt-2 w-full rounded-xl border p-3 text-center text-2xl font-bold tracking-[.4em]"/></label><button type="button" onClick={()=>{setPhase("email");setCode("")}} className="text-sm font-bold text-blue-700">Change email / resend code</button></>}{message&&<p className="text-sm text-emerald-700" role="status">{message}</p>}<button disabled={busy||(phase==="email"&&!token)||(phase==="code"&&code.length!==6)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 font-extrabold text-white hover:bg-blue-800 disabled:opacity-50">{busy?"Please wait...":phase==="email"?"Send login code":"Verify & continue"}<ArrowRight size={18}/></button><div className="flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={16}/> Your courses stay connected to your email</div><p className="text-center text-sm text-slate-600">{signup?"Already a student?":"New to InfraRivet Academy?"} <Link className="font-bold text-blue-700 hover:underline" to={signup?"/login":"/signup"}>{signup?"Sign in":"Create account"}</Link></p></>:<p className="rounded-xl bg-blue-50 p-4 text-center text-sm text-blue-900">Email codes are unavailable on this domain. Please use <strong>Continue with Google</strong> above.</p>}</form></div></div>;
}
