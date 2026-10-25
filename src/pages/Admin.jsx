import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../services/AuthProvider.jsx";
export default function Admin(){
 const {user,loading}=useAuth();const [state,setState]=useState("checking");
 useEffect(()=>{let active=true;if(loading)return;if(!user){setState("signed-out");return;}user.getIdTokenResult(true).then(t=>{if(active)setState(t.claims.admin===true?"allowed":"denied")}).catch(()=>{if(active)setState("error")});return()=>{active=false}},[user,loading]);
 if(loading||state==="checking")return <p className="mx-auto max-w-4xl p-12">Checking administrator access…</p>;
 if(state!=="allowed")return <section className="mx-auto max-w-3xl p-12"><h1 className="text-3xl font-bold">Administrator access required</h1><p className="mt-3 text-slate-600">Sign in with an account that has been granted the admin custom claim. Regular student accounts cannot access this area.</p><Link className="mt-5 inline-block rounded-lg bg-brand px-5 py-3 text-white" to="/login">Sign in</Link></section>;
 return <section className="mx-auto max-w-5xl px-6 py-16"><p className="font-semibold text-brand">EDUTECH ADMIN</p><h1 className="mt-3 text-4xl font-bold">Admin Dashboard</h1><p className="mt-4 text-slate-600">Your administrator account is verified. Course publishing, student management, trial controls, and payment management will be added here. Admin privileges must also be enforced in Firestore and server-side APIs.</p></section>;
}
