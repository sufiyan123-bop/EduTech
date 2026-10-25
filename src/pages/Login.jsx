import { useState } from "react";
import { Link } from "react-router-dom";
import { signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
export default function Login(){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[needsVerification,setNeedsVerification]=useState(false);
 async function submit(e){e.preventDefault();setBusy(true);setError("");setMessage("");setNeedsVerification(false);try{
  const result=await signInWithEmailAndPassword(auth,email,password);
  if(!result.user.emailVerified){setNeedsVerification(true);setError("Please verify your email before accessing courses.");}
  else setMessage("Signed in successfully. Student dashboard is under development.");
 }catch(err){setError("Unable to sign in. Check your email and password.");}finally{setBusy(false)}}
 async function resend(){setError("");setMessage("");try{if(!auth.currentUser||auth.currentUser.email!==email)throw new Error("Please sign in again first.");await sendEmailVerification(auth.currentUser);setMessage("Verification email sent. Check inbox and spam.");await signOut(auth);setNeedsVerification(false);}catch(err){setError(err.message)}}
 async function reset(){if(!email)return setError("Enter your email first.");try{await sendPasswordResetEmail(auth,email);setMessage("If an account exists, a reset email will arrive.");setError("");}catch{setError("Unable to send reset email. Try again later.")}}
 return <section className="mx-auto max-w-md px-6 py-20"><h1 className="mb-6 text-3xl font-bold">Welcome back</h1><form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-8 shadow"><label className="block">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label><label className="block">Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{message&&<p role="status" className="text-sm text-green-700">{message}</p>}{needsVerification&&<button type="button" onClick={resend} className="text-brand underline">Resend verification email</button>}<button disabled={busy} className="w-full rounded-lg bg-brand p-3 font-bold text-white disabled:opacity-50">{busy?"Signing in…":"Sign in"}</button><button type="button" onClick={reset} className="text-sm text-brand underline">Forgot password?</button><p className="text-sm">New to EduTech? <Link to="/signup" className="text-brand underline">Create account</Link></p></form></section>
}
