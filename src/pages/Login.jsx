import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
export default function Login(){
 const navigate=useNavigate();
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");try{
  const credential=await signInWithEmailAndPassword(auth,email.trim(),password);
  const token=await credential.user.getIdTokenResult(true);
  if(token.claims.admin===true){navigate("/admin",{replace:true});return;}
  if(credential.user.email?.toLowerCase()==="sufiyankadival2@gmail.com"){
   try{const owner=await getDoc(doc(db,"system","adminOwner"));navigate(owner.exists()&&owner.data().uid===credential.user.uid?"/admin":"/admin/setup",{replace:true});return;}catch{navigate("/admin/setup",{replace:true});return;}
  }
  navigate("/dashboard",{replace:true});
 }catch(err){setError(err.code==="auth/operation-not-allowed"?"Enable Email/Password in Firebase Authentication → Sign-in method.":err.code==="auth/network-request-failed"?"Network error. Please try again.":"Unable to sign in. Check your email and password.");}finally{setBusy(false)}}
 async function reset(){setError("");setMessage("");if(!email.trim())return setError("Enter your email first.");try{await sendPasswordResetEmail(auth,email.trim());setMessage("If an account exists, a password reset email will arrive.");}catch{setError("Unable to send reset email. Try again later.")}}
 return <section className="mx-auto max-w-md px-6 py-20"><h1 className="mb-2 text-3xl font-bold">Welcome back</h1><p className="mb-6 text-slate-600">Sign in to continue learning.</p><form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-8 shadow"><label className="block">Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label><label className="block">Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{message&&<p role="status" className="text-sm text-green-700">{message}</p>}<button disabled={busy} className="w-full rounded-lg bg-brand p-3 font-bold text-white disabled:opacity-50">{busy?"Signing in…":"Sign in"}</button><button type="button" onClick={reset} className="text-sm text-brand underline">Forgot password?</button><p className="text-sm">New to InfraRivet Academy? <Link to="/signup" className="text-brand underline">Create account</Link></p></form></section>
}
