import { useState } from "react";
import { Link } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";
export default function Signup(){
 const [form,setForm]=useState({name:"",email:"",phone:"",password:"",confirm:""});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 async function submit(e){e.preventDefault();setError("");setMessage("");
  if(form.password!==form.confirm)return setError("Passwords do not match.");
  if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(form.password))return setError("Use at least 8 characters with uppercase, lowercase, number and symbol.");
  setBusy(true);
  try{
   const credential=await createUserWithEmailAndPassword(auth,form.email.trim(),form.password);
   await updateProfile(credential.user,{displayName:form.name.trim()});
   await setDoc(doc(db,"users",credential.user.uid),{name:form.name.trim(),email:credential.user.email,phone:form.phone.trim(),createdAt:serverTimestamp()});
   await sendEmailVerification(credential.user);
   await signOut(auth);
   setMessage("Account created! Check your inbox and spam folder to verify your email. Then sign in.");
  }catch(err){setError(err.code==="auth/email-already-in-use"?"This email already has an account. Please sign in.":err.message)}
  finally{setBusy(false)}
 }
 return <section className="mx-auto max-w-md px-6 py-16"><h1 className="mb-6 text-3xl font-bold">Create your EduTech account</h1><form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-7 shadow">{[["name","Full name","text"],["email","Email","email"],["phone","Phone","tel"],["password","Password","password"],["confirm","Confirm password","password"]].map(([key,label,type])=><label className="block" key={key}>{label}<input className="mt-1 w-full rounded-lg border p-3" name={key} type={type} value={form[key]} onChange={change} required minLength={key==="password"?8:undefined}/></label>)}{error&&<p role="alert" className="text-red-600">{error}</p>}{message&&<p role="status" className="text-green-700">{message}</p>}<button disabled={busy} className="w-full rounded-lg bg-brand p-3 font-bold text-white disabled:opacity-50">{busy?"Creating account…":"Sign up"}</button><p className="text-sm">Already registered? <Link to="/login" className="text-brand underline">Sign in</Link></p></form></section>
}
