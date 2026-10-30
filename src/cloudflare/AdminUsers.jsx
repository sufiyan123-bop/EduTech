import {useCallback,useEffect,useState} from "react";
import {api,formatPrice,readableDate} from "./api.js";
import {Download,Edit3,Search,ShieldAlert,UserRound,Users,RefreshCw,ArrowLeft,CheckCircle2,BookOpen,Trash2} from "lucide-react";

const field="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-blue-600";
const button="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const fmt=n=>n?new Date(n*1000).toLocaleString("en-IN",{dateStyle:"medium"}):"—";
const trialDate=n=>n?new Date(n*1000).toISOString().slice(0,10):"";
function csvField(value){
 let text=String(value??"");
 if(/^[\s]*[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function downloadCsv(rows){
 const columns=[
  ["Name","displayName"],["Email","email"],["Role","role"],
  ["Login provider","authProvider"],["Joined","createdAt"],
  ["Trial ends","trialExpiresAt"],["Active courses","activeCourses"],
  ["Paid orders","paidOrders"],["Last sign in","lastSessionAt"]
 ];
 const lines=[columns.map(c=>csvField(c[0])).join(",")];
 for(const row of rows){
  lines.push(columns.map(([_,key])=>csvField(["createdAt","trialExpiresAt","lastSessionAt"].includes(key)?fmt(row[key]):row[key])).join(","));
 }
 const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="infrarivet-users.csv";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Stat({label,value}){
 return <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-xl text-slate-900">{value??"—"}</strong></div>;
}
export default function AdminUsers({courses=[],onGrantAdmin=()=>{}}){
 const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[filter,setFilter]=useState("all"),[sort,setSort]=useState("newest"),[page,setPage]=useState(1);
 const [list,setList]=useState([]),[total,setTotal]=useState(0),[summary,setSummary]=useState(null);
 const [selected,setSelected]=useState(""),[detail,setDetail]=useState(null),[name,setName]=useState(""),[expires,setExpires]=useState("");
 const [courseId,setCourseId]=useState(""),[courseExpiry,setCourseExpiry]=useState("");
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [exporting,setExporting]=useState(false);
 const [deleteTarget,setDeleteTarget]=useState(null),[confirmEmail,setConfirmEmail]=useState(""),[deleteError,setDeleteError]=useState("");
 const size=20;
 const loadDetail=useCallback(async id=>{
  const data=await api("/api/admin/users/"+encodeURIComponent(id));
  setDetail(data);setName(data.user.displayName||"");setExpires(trialDate(data.user.trialExpiresAt));
 },[]);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  const params=new URLSearchParams({q:search,filter,sort,page:String(page),size:String(size)});
  api("/api/admin/users?"+params).then(data=>{
   if(!active)return;
   setList(data.users||[]);setTotal(data.total||0);setSummary(data.summary||null);
  }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[search,filter,sort,page,reload]);
 async function openUser(id){
  setSelected(id);setDetail(null);setError("");setMessage("");
  try{await loadDetail(id)}catch(e){setError(e.message)}
 }
 async function mutation(fn,success="Changes saved"){
  setBusy(true);setError("");setMessage("");
  try{
   await fn();
   if(selected)await loadDetail(selected);
   setReload(v=>v+1);setMessage(success);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function beginDelete(u){
  setDeleteTarget({id:u.id,email:u.email,displayName:u.displayName||u.email});
  setConfirmEmail("");setDeleteError("");setError("");setMessage("");
 }
 async function deleteAccount(){
  if(!deleteTarget||busy||confirmEmail.trim().toLowerCase()!==deleteTarget.email.toLowerCase())return;
  setBusy(true);setDeleteError("");
  try{
   const result=await api("/api/admin/users/"+encodeURIComponent(deleteTarget.id),{
    method:"DELETE",body:{confirmEmail}
   });
   if(selected===deleteTarget.id){setSelected("");setDetail(null)}
   setDeleteTarget(null);setConfirmEmail("");
   setReload(v=>v+1);
   setMessage(result.retainedPaymentRecords
    ?"User account removed. Payment records were retained without the user's personal profile."
    :"User account and access deleted successfully.");
  }catch(e){setDeleteError(e.message)}finally{setBusy(false)}
 }
 function submitSearch(e){e.preventDefault();setPage(1);setSearch(query.trim())}
 async function exportAll(){
  setExporting(true);setError("");setMessage("");
  try{
   const data=[],maxPages=100;
   for(let p=1;p<=maxPages;p++){
    const args=new URLSearchParams({q:search,filter,sort,page:String(p),size:"50"});
    const result=await api("/api/admin/users?"+args);
    data.push(...(result.users||[]));
    if(data.length>=result.total||!(result.users||[]).length)break;
   }
   downloadCsv(data);
   setMessage("Exported "+data.length+" users. The file includes the current search/filter.");
  }catch(e){setError(e.message)}finally{setExporting(false)}
 }
 const totalPages=Math.max(1,Math.ceil(total/size));
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Owner tools</p><h2 className="mt-1 text-2xl font-extrabold">All users</h2>
    <p className="mt-2 text-sm text-slate-600">Find students, view course access, edit profiles and manage trials. Email and staff roles stay protected.</p></div>
   <button onClick={exportAll} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"><Download size={16}/>{exporting?"Exporting...":"Export CSV"}</button>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
   <Stat label="Registered users" value={summary?.total}/>
   <Stat label="Active learners" value={summary?.activeLearners}/>
   <Stat label="Active trials" value={summary?.activeTrials}/>
   <Stat label="Paying learners" value={summary?.payingLearners}/>
   <Stat label="Team members" value={summary?.teamMembers}/>
  </div>
  <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
   <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
    <label className="relative min-w-[190px] flex-1"><span className="sr-only">Search users</span><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or email" className="w-full rounded-xl border px-9 py-3 text-sm"/></label>
    <button className={button}>Search</button>
    <button type="button" onClick={()=>{setQuery("");setSearch("");setFilter("all");setPage(1)}} className="rounded-xl border px-3 py-2 text-sm font-bold">Clear</button>
   </form>
   <div className="mt-3 flex flex-wrap gap-3">
    <label className="flex-1 text-xs font-bold text-slate-500">Show
     <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}} className={field}>
      <option value="all">All users</option><option value="enrolled">Active enrollments</option><option value="trial">Active trial</option><option value="paid">Paid customers</option><option value="staff">Active team</option><option value="no-access">No active course</option>
     </select>
    </label>
    <label className="flex-1 text-xs font-bold text-slate-500">Sort
     <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}} className={field}>
      <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="email">Email A–Z</option>
     </select>
    </label>
    <button onClick={()=>setReload(v=>v+1)} title="Refresh users" className="self-end rounded-xl border p-3"><RefreshCw size={17}/></button>
   </div>
   <p className="mt-4 text-xs text-slate-500">{loading?"Loading users...":total+" matching users · page "+page+" of "+totalPages}</p>
   <div className="mt-3 divide-y">{list.map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="flex min-w-0 flex-1 items-center gap-3">
     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-800">{(u.displayName||u.email||"?").charAt(0).toUpperCase()}</div>
     <div className="min-w-0"><p className="break-words text-sm font-bold text-slate-900">{u.displayName||"Unnamed student"}</p><p className="break-all text-xs text-slate-500">{u.email}</p>
      <p className="mt-1 text-xs text-slate-500">{u.role} · {u.activeCourses} active courses · Joined {readableDate(u.createdAt)}{u.paidOrders>0?" · "+u.paidOrders+" paid order(s)":""}</p>
     </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <button onClick={()=>openUser(u.id)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"><Edit3 size={14}/> View / edit</button>
     {onGrantAdmin&&u.role!=="owner"&&<button onClick={()=>onGrantAdmin(u)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><ShieldAlert size={14}/> {u.staffActive===1?"Admin permissions":"Make admin"}</button>}
     <button onClick={()=>beginDelete(u)} disabled={busy||u.role==="owner"||u.staffActive===1}
      title={u.role==="owner"?"Owner accounts cannot be deleted":u.staffActive===1?"Remove active staff permissions first":"Delete this user"}
      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
      <Trash2 size={14}/> Delete
     </button>
    </div>
   </div>)}
   {!loading&&list.length===0&&<p className="py-8 text-center text-sm text-slate-500">No users found. Try another search or filter.</p>}</div>
   <div className="mt-4 flex items-center justify-between gap-3">
    <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1||loading} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
    <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
    <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages||loading} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">Next</button>
   </div>
  </section>
  {selected&&<section className="rounded-2xl border-2 border-blue-200 bg-white p-4 shadow-md sm:p-6" aria-label="User details">
   <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue-700">Student profile</p><h3 className="mt-1 break-words text-xl font-extrabold">{detail?.user?.displayName||"User details"}</h3></div><button onClick={()=>{setSelected("");setDetail(null);setMessage("");setError("")}} className="rounded-xl border px-3 py-2 text-sm font-bold">Close</button></div>
   {!detail?<p className="mt-5 text-sm">Loading user details...</p>:<>
    <p className="mt-2 break-all text-sm text-slate-600">{detail.user.email} · {detail.user.role} · {detail.user.authProvider}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
     <Stat label="Joined" value={fmt(detail.user.createdAt)}/>
     <Stat label="Active sessions" value={detail.activity?.activeSessions}/>
     <Stat label="Lessons completed" value={detail.activity?.completedLessons}/>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
     <form className="rounded-xl border p-4" onSubmit={e=>{e.preventDefault();mutation(()=>api("/api/admin/users/"+encodeURIComponent(selected),{method:"PUT",body:{displayName:name}}),"Profile updated")}}>
      <h4 className="font-extrabold">Edit user profile</h4>
      <label className="mt-3 block text-xs font-bold">Display name<input className={field} value={name} maxLength={120} required onChange={e=>setName(e.target.value)}/></label>
      <p className="mt-2 text-xs text-slate-500">Email cannot be edited here because it is linked to verified sign-in.</p>
      <button disabled={busy} className={"mt-4 "+button}>Save name</button>
     </form>
     <form className="rounded-xl border p-4" onSubmit={e=>{e.preventDefault();const expiry=expires?Math.floor(new Date(expires+"T23:59:59+05:30").getTime()/1000):null;mutation(()=>api("/api/admin/users/"+encodeURIComponent(selected),{method:"PUT",body:{trialExpiresAt:expiry}}),"Trial updated")}}>
      <h4 className="font-extrabold">Free trial</h4>
      <label className="mt-3 block text-xs font-bold">Expiry date<input type="date" className={field} value={expires} onChange={e=>setExpires(e.target.value)}/></label>
      <p className="mt-2 text-xs text-slate-500">Clear date to remove trial, or choose an expiry date.</p>
      <div className="mt-3 flex flex-wrap gap-2">{[7,30,90].map(days=><button type="button" key={days} disabled={busy} onClick={()=>mutation(()=>api("/api/admin/users/"+encodeURIComponent(selected),{method:"PUT",body:{trialExpiresAt:Math.floor(Date.now()/1000)+days*86400}}),days+"-day trial granted")} className="rounded-lg border px-3 py-2 text-xs font-bold">+{days} days</button>)}</div>
      <button disabled={busy} className={"mt-4 "+button}>Save trial</button>
     </form>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
     <section className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-extrabold"><BookOpen size={18}/> Course access ({detail.enrollments.length})</h4>
      <form onSubmit={e=>{e.preventDefault();mutation(()=>api("/api/admin/enrollments",{method:"POST",body:{email:detail.user.email,courseId,expiresAt:courseExpiry||null}}),"Course access granted")}} className="mt-3 space-y-3">
       <select required className={field} value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">Choose course</option>{courses.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select>
       <label className="block text-xs font-semibold">Access expires (optional)<input type="date" className={field} value={courseExpiry} onChange={e=>setCourseExpiry(e.target.value)}/></label>
       <button disabled={busy||!courseId} className={button}>Grant / renew course</button>
      </form>
      <div className="mt-4 divide-y">{detail.enrollments.map(e=><div key={e.courseId} className="flex items-center justify-between gap-3 py-3">
       <div><p className="text-sm font-bold">{e.title}</p><p className="text-xs text-slate-500">{e.source} · {e.expiresAt?"Until "+fmt(e.expiresAt):"Lifetime"}</p></div>
       <button disabled={busy} onClick={()=>{if(window.confirm("Revoke "+detail.user.email+"'s access to "+e.title+"?"))mutation(()=>api("/api/admin/enrollments",{method:"DELETE",body:{userId:detail.user.id,courseId:e.courseId}}),"Course access revoked")}} className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-700">Revoke</button>
      </div>)}
      {!detail.enrollments.length&&<p className="py-3 text-sm text-slate-500">No assigned courses</p>}</div>
     </section>
     <section className="rounded-xl border p-4"><h4 className="font-extrabold">Payment history ({detail.payments.length})</h4>
      <p className="mt-1 text-xs text-slate-500">Read-only records; no payment information can be edited here.</p>
      <div className="mt-3 max-h-72 divide-y overflow-y-auto">{detail.payments.map((p,i)=><div key={i} className="py-3"><p className="text-sm font-bold">{p.title} · {formatPrice(p.amountPaise/100)}</p><p className="text-xs text-slate-500">{p.state} · {p.months} month(s) · {fmt(p.createdAt)}</p></div>)}
      {!detail.payments.length&&<p className="py-3 text-sm text-slate-500">No payments recorded</p>}</div>
      <div className="mt-5 border-t pt-4"><h4 className="flex items-center gap-2 text-sm font-extrabold"><ShieldAlert size={17}/> Account security</h4><p className="mt-2 text-xs text-slate-600">Last session: {fmt(detail.activity?.lastSessionAt)}. Sign out all other sessions without deleting user data.</p>
       <button disabled={busy||detail.user.role==="owner"} onClick={()=>{if(window.confirm("Sign out all sessions for "+detail.user.email+"?"))mutation(()=>api("/api/admin/users/"+encodeURIComponent(selected)+"/sessions",{method:"DELETE"}),"All user sessions revoked")}} className="mt-3 rounded-xl border border-amber-300 px-4 py-2.5 text-xs font-bold text-amber-900 disabled:opacity-40">Revoke all sessions</button>
       <div className="mt-5 border-t border-red-100 pt-4">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-red-800"><Trash2 size={16}/> Delete account</h4>
        <p className="mt-2 text-xs text-slate-600">Remove this user's profile, sessions, course access and learning progress. Historical payment records are retained without their personal profile.</p>
        <button disabled={busy||detail.user.role==="owner"||detail.user.staffActive===1}
         onClick={()=>beginDelete(detail.user)}
         className="mt-3 rounded-xl border border-red-300 px-4 py-2.5 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-40">
         Delete user
        </button>
        {detail.user.staffActive===1&&detail.user.role!=="owner"&&<p className="mt-2 text-xs text-amber-800">Remove this user from the active admin team first.</p>}
       </div>
      </div>
     </section>
    </div>
   </>}
  </section>}
  {deleteTarget&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
   <section role="dialog" aria-modal="true" aria-labelledby="delete-user-heading"
    className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
    <h3 id="delete-user-heading" className="flex items-center gap-2 text-xl font-extrabold text-red-800"><ShieldAlert size={22}/> Delete user account?</h3>
    <p className="mt-3 break-words text-sm text-slate-700">You are about to remove <strong>{deleteTarget.displayName}</strong> ({deleteTarget.email}).</p>
    <p className="mt-3 text-sm text-slate-700">This action cannot be undone. The user will be signed out, lose course access, and their learning progress will be removed. If payment orders exist, required financial records are retained under an anonymized account.</p>
    <label className="mt-5 block text-sm font-semibold text-slate-800">Type <span className="break-all font-extrabold text-red-700">{deleteTarget.email}</span> to confirm
     <input autoFocus type="email" autoComplete="off" value={confirmEmail} onChange={e=>setConfirmEmail(e.target.value)} className={field} placeholder="Exact user email"/>
    </label>
    {deleteError&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{deleteError}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
     <button disabled={busy} onClick={()=>{setDeleteTarget(null);setDeleteError("");setConfirmEmail("")}} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40">Cancel</button>
     <button disabled={busy||confirmEmail.trim().toLowerCase()!==deleteTarget.email.toLowerCase()} onClick={deleteAccount}
      className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40">
      <Trash2 size={16}/>{busy?"Deleting...":"Delete user permanently"}
     </button>
    </div>
   </section>
  </div>}
 </div>;
}
