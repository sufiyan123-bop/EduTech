import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";
const authError = code => ({
 "auth/email-already-in-use":"An account already exists with this email. Please sign in.",
 "auth/invalid-email":"Enter a valid email address.",
 "auth/weak-password":"Choose a stronger password.",
 "auth/operation-not-allowed":"Email/password signup is disabled. Enable it in Firebase Authentication → Sign-in method.",
 "auth/network-request-failed":"Network error. Check your connection and try again.",
 "auth/too-many-requests":"Too many attempts. Please try again later."
}[code] || "We couldn't create your account. Please try again.");
export default function Signup(){
 const navigate=useNavigate();
 const [form,setForm]=useState({name:"",email:"",password:"",confirm:""});
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 async function submit(e){e.preventDefault();if(busy)return;setError("");
  if(!form.name.trim())return setError("Enter your full name.");
  if(form.password.length<8)return setError("Password must contain at least 8 characters.");
  if(form.password!==form.confirm)return setError("Passwords do not match.");
  setBusy(true);
  try {
   const credential=await createUserWithEmailAndPassword(auth,form.email.trim(),form.password);
   try {await updateProfile(credential.user,{displayName:form.name.trim()});}catch(e){console.warn("Display name update pending",e)}
   try {await setDoc(doc(db,"users",credential.user.uid),{name:form.name.trim(),email:credential.user.email,createdAt:serverTimestamp()});}catch(e){console.warn("Student profile sync pending",e)}
   navigate("/dashboard",{replace:true});
  }catch(err){setError(authError(err.code));}finally{setBusy(false)}
 }
 return <section className="mx-auto max-w-md px-6 py-16"><h1 className="mb-2 text-3xl font-bold">Create your account</h1><p className="mb-6 text-slate-600">Join InfraRivet Academy and start learning today.</p><form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-7 shadow">{[["name","Full name","text"],["email","Email address","email"],["password","Password","password"],["confirm","Confirm password","password"]].map(([key,label,type])=><label className="block" key={key}>{label}<input className="mt-1 w-full rounded-lg border p-3" name={key} type={type} value={form[key]} onChange={change} autoComplete={key==="name"?"name":key==="email"?"email":"new-password"} required minLength={key==="password"?8:undefined}/></label>)}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-brand p-3 font-bold text-white disabled:opacity-50">{busy?"Creating your account…":"Create account"}</button><p className="text-center text-sm">Already have an account? <Link to="/login" className="text-brand underline">Sign in</Link></p></form></section>
}
