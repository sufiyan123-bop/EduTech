import {useCallback,useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {api,formatPrice,readableDate} from "./api.js";
import CourseThumbnail from "../components/CourseThumbnail.jsx";
import AdminUsers from "./AdminUsers.jsx";
import {useAuth} from "./Auth.jsx";
import {ArrowRight,BookOpen,CheckCircle2,CloudUpload,GraduationCap,LayoutDashboard,Plus,Save,ShieldCheck,Trash2,Users,Video,X} from "lucide-react";
const emptyCourse={title:"",description:"",track:"",price:0,thumbnail:"",published:false,status:"available",featured:false,homeOrder:999,level:"Beginner",duration:"",instructor:"",language:"English",badge:"",plans:{"1":"","3":"","6":"","12":""},includedCourseIds:[]};
const emptyLecture={id:"",title:"",chapter:"General",youtubeId:"",r2ObjectKey:"",order:0,trialEnabled:false,freePreview:false};
const input="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-blue-600";
const pill=(active)=>"rounded-xl px-4 py-2.5 text-sm font-bold transition "+(active?"bg-blue-700 text-white":"bg-slate-100 text-slate-700 hover:bg-blue-50");
const defaultAdminPermissions=["courses.view"];
const permissionOptions=[["courses.view","View courses"],["courses.manage","Create, edit and delete courses"],["lectures.manage","Manage lessons and videos"],["enrollments.manage","Grant and revoke student course access"],["users.manage","Manage normal student accounts"]];
function Label({children,...props}){return <label className="block text-sm font-semibold text-slate-700" {...props}>{children}</label>}
export default function Admin(){
 const {user}=useAuth(),[tab,setTab]=useState("overview"),[courses,setCourses]=useState([]),[stats,setStats]=useState(null),[enrollments,setEnrollments]=useState([]),[staff,setStaff]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [editing,setEditing]=useState(""),[form,setForm]=useState({...emptyCourse}),[selectedCourse,setSelectedCourse]=useState(""),[lectures,setLectures]=useState([]),[lecture,setLecture]=useState({...emptyLecture}),[uploading,setUploading]=useState(false),[uploadingThumb,setUploadingThumb]=useState(false),[grant,setGrant]=useState({email:"",courseId:"",expiresAt:""}),[staffForm,setStaffForm]=useState({email:"",permissions:[...defaultAdminPermissions]}),[editingStaffId,setEditingStaffId]=useState(""),[category,setCategory]=useState("");
 const isOwner=user?.role==="owner",perms=user?.permissions||[];
 const may=p=>isOwner||perms.includes("*")||perms.includes(p);
 const refresh=useCallback(async()=>{const [a,b]=await Promise.all([api("/api/admin/courses"),api("/api/admin/overview")]);setCourses(a.courses||[]);setStats(b.stats)},[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[refresh]);
 useEffect(()=>{if(tab==="enrollments")api("/api/admin/enrollments").then(d=>setEnrollments(d.enrollments||[])).catch(e=>setError(e.message));if(tab==="team"&&isOwner)api("/api/admin/staff").then(d=>setStaff(d.staff||[])).catch(e=>setError(e.message))},[tab,isOwner]);
 useEffect(()=>{if(!selectedCourse)return;api("/api/admin/lectures?courseId="+encodeURIComponent(selectedCourse)).then(d=>setLectures(d.lectures||[])).catch(e=>setError(e.message))},[selectedCourse]);
 function set(k,value){setForm(v=>({...v,[k]:value}))}
 function resetCourse(){setEditing("");setForm({...emptyCourse,plans:{...emptyCourse.plans},includedCourseIds:[]})}
 function edit(c){setEditing(c.id);setForm({...emptyCourse,...c,plans:{"1":"","3":"","6":"","12":""},...c,plans:{...emptyCourse.plans,...(c.plans||{})},includedCourseIds:[...(c.includedCourseIds||[])]});setTab("courses");window.scrollTo({top:0,behavior:"smooth"})}
 async function act(fn){
  setBusy(true);setError("");setMessage("");
  try{await fn();setMessage("Changes saved successfully.")}catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function uploadThumbnail(file){
  if(!file)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Choose a JPG, PNG or WebP image");return;}
  if(file.size>3*1024*1024){setError("Thumbnail must be smaller than 3 MB");return;}
  setUploadingThumb(true);setError("");setMessage("");
  try{
   const d=await api("/api/admin/thumbnail-upload",{method:"PUT",headers:{"Content-Type":file.type},body:file});
   set("thumbnail",d.url);
   setMessage("Thumbnail uploaded to Cloudflare! Click Save course to publish the change.");
  }catch(e){setError(e.message)}
  finally{setUploadingThumb(false)}
 }
 async function saveCourse(e){e.preventDefault();await act(async()=>{
  if(editing)await api("/api/admin/courses/"+encodeURIComponent(editing),{method:"PUT",body:form});
  else{const d=await api("/api/admin/courses",{method:"POST",body:{...form,includedCourseIds:[]}});setEditing(d.id)}
  await refresh();
 });}
 async function removeCourse(id){if(!window.confirm("Delete this course permanently? Enrolled courses cannot be deleted."))return;await act(async()=>{await api("/api/admin/courses/"+encodeURIComponent(id),{method:"DELETE"});resetCourse();await refresh()})}
 async function loadLectures(courseId){setSelectedCourse(courseId);setLecture({...emptyLecture})}
 async function saveLecture(e){e.preventDefault();await act(async()=>{
  const body={...lecture,courseId:selectedCourse};await api("/api/admin/lectures",{method:lecture.id?"PUT":"POST",body});
  const d=await api("/api/admin/lectures?courseId="+encodeURIComponent(selectedCourse));setLectures(d.lectures||[]);setLecture({...emptyLecture,order:(d.lectures||[]).length+1});
 });}
 async function deleteLecture(item){if(!window.confirm("Delete lecture and student progress permanently?"))return;await act(async()=>{await api("/api/admin/lectures",{method:"DELETE",body:{courseId:selectedCourse,id:item.id}});const d=await api("/api/admin/lectures?courseId="+encodeURIComponent(selectedCourse));setLectures(d.lectures||[])})}
 async function upload(file){
  if(!file)return;
  if(!selectedCourse){setError("Choose a course before uploading");return}
  if(file.size>90*1024*1024){setError("Choose a file smaller than 90 MB");return}
  if(!["video/mp4","video/webm"].includes(file.type)){setError("Only MP4 and WebM are supported");return}
  setUploading(true);setError("");
  try{const d=await api("/api/admin/upload",{method:"PUT",headers:{"X-Course-Id":selectedCourse,"Content-Type":file.type},body:file});setLecture(l=>({...l,r2ObjectKey:d.r2ObjectKey,youtubeId:""}));setMessage("Video uploaded privately. Save the lecture to attach it.")}
  catch(e){setError(e.message)}finally{setUploading(false)}
 }
 async function grantAccess(e){e.preventDefault();await act(async()=>{await api("/api/admin/enrollments",{method:"POST",body:{...grant,expiresAt:grant.expiresAt||null}});setEnrollments((await api("/api/admin/enrollments")).enrollments||[]);setGrant(v=>({...v,email:""}))})}
 async function revoke(g){if(!window.confirm("Revoke this student course access?"))return;await act(async()=>{await api("/api/admin/enrollments",{method:"DELETE",body:{userId:g.userId,courseId:g.courseId}});setEnrollments((await api("/api/admin/enrollments")).enrollments||[])})}
 async function addStaff(e){
  e.preventDefault();
  if(!staffForm.permissions.length){setError("Choose at least one permission.");return;}
  await act(async()=>{
   await api("/api/admin/staff",{method:"POST",body:staffForm});
   setStaff((await api("/api/admin/staff")).staff||[]);
   setStaffForm({email:"",permissions:[...defaultAdminPermissions]});
   setEditingStaffId("");
  });
 }
 function editStaff(s){
  if(s.role==="owner")return;
  setStaffForm({email:s.email,permissions:[...s.permissions]});
  setEditingStaffId(s.userId);setError("");setMessage("");setTab("team");
 }
 async function removeStaff(s){
  if(s.role==="owner")return;
  if(!window.confirm("Remove admin access from "+s.email+"? Their student account, payments and courses will stay unchanged."))return;
  await act(async()=>{
   await api("/api/admin/staff",{method:"DELETE",body:{userId:s.userId}});
   setStaff((await api("/api/admin/staff")).staff||[]);
   if(editingStaffId===s.userId){setEditingStaffId("");setStaffForm({email:"",permissions:[...defaultAdminPermissions]})}
  });
 }
 function grantAdminFromUser(u){
  if(!isOwner||u.role==="owner")return;
  setEditingStaffId("");
  setStaffForm({email:u.email,permissions:[...defaultAdminPermissions]});
  setError("");setMessage("");setTab("team");
 }
 if(!user?.role)return <div className="mx-auto max-w-4xl p-16"><h1 className="text-2xl font-extrabold">Admin access required</h1><p className="mt-3 text-slate-600">Your account needs an administrator role in Cloudflare D1.</p><Link to="/dashboard" className="mt-4 inline-block text-blue-700 underline">Back to dashboard</Link></div>;
 return <div className="min-h-[85vh] bg-[#f5f7fb]"><div className="bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-9 text-white"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-widest text-sky-300">InfraRivet Academy management</p><h1 className="mt-2 text-3xl font-extrabold">Administration</h1><p className="mt-2 text-sm text-slate-300">Manage your learning platform from one place. {isOwner?"Owner account":"Staff access"}</p></div></div><div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 lg:grid-cols-[235px_minmax(0,1fr)]"><nav className="flex flex-wrap content-start gap-2 self-start rounded-2xl border bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:flex-col">{[["overview","Overview",LayoutDashboard],["users","All users",Users],["courses","Courses",BookOpen],["lectures","Video lessons",Video],["enrollments","Student access",Users],["team","Team",ShieldCheck]].filter(([key])=>key==="overview"||key==="team"||key==="users"?isOwner||key==="overview"||(key==="users"&&may("users.manage")):key==="courses"?may("courses.view"):key==="lectures"?may("lectures.manage"):may("enrollments.manage")).map(([key,label,Icon])=><button key={key} onClick={()=>{setTab(key);setError("");setMessage("")}} className={"flex items-center gap-2 "+pill(tab===key)}><Icon size={17}/>{label}</button>)}</nav>
 <main className="min-w-0">{error&&<div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{message&&<div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
 {tab==="overview"&&<><h2 className="text-2xl font-extrabold">Platform overview</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Courses",stats?.courses,BookOpen],["Lessons",stats?.lectures,Video],["Students",stats?.students,Users],["Active enrollments",stats?.activeEnrollments,GraduationCap]].map(([label,value,Icon])=><div key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="text-blue-700"/><p className="mt-3 text-sm text-slate-500">{label}</p><strong className="mt-2 block text-3xl">{value??"—"}</strong></div>)}</div><section className="mt-7 rounded-2xl border bg-white p-6"><h3 className="text-lg font-extrabold">Ready to teach</h3><p className="mt-2 text-sm leading-7 text-slate-600">Create a master program like AiOps, add smaller included courses, upload private R2 videos, then manage student enrollments here.</p><button onClick={()=>setTab("courses")} className="mt-4 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Manage courses</button>{isOwner&&<button onClick={()=>setTab("users")} className="ml-2 mt-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-800">View all users</button>}</section></>}
 {tab==="users"&&(isOwner||may("users.manage"))&&<AdminUsers courses={courses} onGrantAdmin={isOwner?grantAdminFromUser:null}/>}
 {tab==="courses"&&<div className="space-y-6"><section className="rounded-2xl border bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Course builder</p><h2 className="mt-1 text-2xl font-extrabold">{editing?"Edit course":"Create a course"}</h2></div><button onClick={resetCourse} className="rounded-xl border px-4 py-2 text-sm font-bold"><Plus size={15} className="mr-1 inline"/> New course</button></div><form onSubmit={saveCourse} className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Label>Course title<input required className={input} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="AiOps Master Program"/></Label><Label>Category / Track<input className={input} value={form.track||""} onChange={e=>set("track",e.target.value)} placeholder="DevOps, AI, Cloud"/></Label><Label>Price (₹)<input type="number" min="0" className={input} value={form.price} onChange={e=>set("price",e.target.value)}/></Label><Label>Thumbnail URL<input type="url" className={input} value={form.thumbnail||""} onChange={e=>set("thumbnail",e.target.value)} placeholder="https://i.ibb.co/.../photo.jpg"/><span className="mt-1 block text-xs font-normal text-slate-500">Recommended: upload a picture below. Direct HTTPS image URLs also work. ImgBB share pages can block automatic conversion.</span></Label><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 sm:col-span-2"><label className="block text-sm font-bold text-blue-900">Upload thumbnail from your device (no ImgBB required)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingThumb||busy} onChange={e=>{uploadThumbnail(e.target.files?.[0]);e.target.value="";}} className="mt-2 block w-full text-xs text-blue-800 disabled:opacity-50"/></label><p className="mt-2 text-xs text-blue-800">JPG, PNG or WebP up to 3 MB. Files are stored in Cloudflare R2. After upload, click Save course.</p>{uploadingThumb&&<p className="mt-2 text-sm font-semibold">Uploading thumbnail...</p>}</div><Label>Level<input className={input} value={form.level||""} onChange={e=>set("level",e.target.value)}/></Label><Label>Duration<input className={input} value={form.duration||""} onChange={e=>set("duration",e.target.value)} placeholder="40 hours"/></Label><Label>Instructor<input className={input} value={form.instructor||""} onChange={e=>set("instructor",e.target.value)}/></Label><Label>Language<input className={input} value={form.language||""} onChange={e=>set("language",e.target.value)}/></Label><Label>Sort order<input type="number" className={input} value={form.homeOrder} onChange={e=>set("homeOrder",Number(e.target.value))}/></Label><Label>Availability<select className={input} value={form.status||"available"} onChange={e=>set("status",e.target.value)}><option value="available">Available</option><option value="comingSoon">Coming soon</option></select></Label></div>{form.thumbnail&&<div className="max-w-xs"><p className="mb-2 text-xs font-bold text-slate-600">Thumbnail preview (ImgBB page links may not preview; use upload instead)</p><div className="aspect-video overflow-hidden rounded-xl border border-slate-200"><CourseThumbnail src={form.thumbnail} alt="Course thumbnail preview"/></div></div>}<Label>Course description<textarea rows={4} className={input} value={form.description||""} onChange={e=>set("description",e.target.value)}/></Label><div className="flex flex-wrap gap-5 text-sm font-semibold"><label className="flex items-center gap-2"><input type="checkbox" checked={!!form.published} onChange={e=>set("published",e.target.checked)}/> Published</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!form.featured} onChange={e=>set("featured",e.target.checked)}/> Featured</label></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h3 className="font-extrabold text-blue-950">One purchase → all included courses</h3><p className="mt-2 text-xs leading-6 text-blue-800">First create the master course and smaller courses separately. Then edit the master to select included courses. Students buy the master once.</p>{editing?<div className="mt-4 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">{courses.filter(c=>c.id!==editing&&!(c.includedCourseIds||[]).length).map(c=><label key={c.id} className="flex gap-2 rounded-lg bg-white p-3 text-sm"><input type="checkbox" checked={(form.includedCourseIds||[]).includes(c.id)} onChange={e=>set("includedCourseIds",e.target.checked?[...(form.includedCourseIds||[]),c.id]:(form.includedCourseIds||[]).filter(x=>x!==c.id))}/><span>{c.title}</span></label>)}</div>:<p className="mt-3 text-xs text-blue-800">Save this course first to configure the bundle.</p>}</div><div><h3 className="font-extrabold">Razorpay plan prices (₹)</h3><div className="mt-3 grid gap-3 sm:grid-cols-4">{[1,3,6,12].map(m=><Label key={m}>{m} month{m>1?"s":""}<input type="number" min="0" className={input} value={typeof form.plans?.[String(m)]==="object"?(form.plans[String(m)].price||""):(form.plans?.[String(m)]||"")} onChange={e=>set("plans",{...form.plans,[String(m)]:e.target.value})}/></Label>)}</div></div><button disabled={busy||!may("courses.manage")} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-extrabold text-white disabled:opacity-50"><Save size={17}/>{busy?"Saving...":"Save course"}</button></form></section><section className="rounded-2xl border bg-white p-6"><h2 className="mb-4 text-xl font-extrabold">All courses ({courses.length})</h2><div className="divide-y">{courses.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{c.title}</p><p className="mt-1 text-xs text-slate-500">{formatPrice(c.price)} · {c.published?"Published":"Draft"} · {(c.includedCourseIds||[]).length} included courses</p></div><div className="flex items-center gap-2"><Link to={"/courses/"+encodeURIComponent(c.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">Preview</Link><button onClick={()=>edit(c)} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">Edit</button><button onClick={()=>removeCourse(c.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={16}/></button></div></div>)}</div></section></div>}
 {tab==="lectures"&&<div className="space-y-6"><section className="rounded-2xl border bg-white p-6"><h2 className="text-2xl font-extrabold">Video lesson manager</h2><p className="mt-2 text-sm text-slate-600">Private video hosting offers stronger access controls. YouTube (including unlisted videos) is shareable and is blocked for paid lessons. Use YouTube only for free/public content.</p><Label className="block">Select course<select className={input} value={selectedCourse} onChange={e=>loadLectures(e.target.value)}><option value="">Choose a course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Label>{selectedCourse&&<form onSubmit={saveLecture} className="mt-6 space-y-4"><Label>Lesson name<input className={input} required value={lecture.title} onChange={e=>setLecture(v=>({...v,title:e.target.value}))}/></Label><Label>Chapter / Section<input className={input} value={lecture.chapter||"General"} onChange={e=>setLecture(v=>({...v,chapter:e.target.value}))} placeholder="Chapter 1 · Linux basics"/></Label><div className="grid gap-4 sm:grid-cols-2"><Label>Lesson number<input type="number" className={input} value={lecture.order} onChange={e=>setLecture(v=>({...v,order:Number(e.target.value)}))}/></Label><Label>YouTube link or video ID<input className={input} value={lecture.youtubeId||""} onChange={e=>setLecture(v=>({...v,youtubeId:e.target.value,r2ObjectKey:""}))}/></Label></div><div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-5"><div className="mb-2 flex items-center gap-2 font-extrabold text-blue-900"><CloudUpload size={20}/> Private R2 video upload</div><p className="mb-3 text-xs text-blue-800">MP4 or WebM, up to 90 MB. Requires your own private Cloudflare R2 bucket binding; video playback is checked against student access rights. Do not put paid lessons on public video links.</p><input type="file" accept="video/mp4,video/webm" disabled={uploading} onChange={e=>upload(e.target.files?.[0])} className="max-w-full text-sm"/>{uploading&&<p className="mt-2 text-sm font-bold text-blue-700">Uploading video…</p>}{lecture.r2ObjectKey&&<p className="mt-2 break-all text-xs text-emerald-700">Uploaded: {lecture.r2ObjectKey}</p>}</div><div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={!!lecture.trialEnabled} onChange={e=>setLecture(v=>({...v,trialEnabled:e.target.checked}))}/> Free trial — any signed-in student</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!lecture.freePreview} onChange={e=>setLecture(v=>({...v,freePreview:e.target.checked}))}/> Preview label</label></div><div className="flex gap-3"><button disabled={busy||uploading} className="rounded-xl bg-blue-700 px-6 py-3 font-extrabold text-white disabled:opacity-50">{lecture.id?"Update lesson":"Add lesson"}</button>{lecture.id&&<button type="button" onClick={()=>setLecture({...emptyLecture})} className="rounded-xl border px-5 py-3">Cancel edit</button>}</div></form>}</section>{selectedCourse&&<section className="rounded-2xl border bg-white p-6"><h3 className="text-xl font-extrabold">Existing lessons ({lectures.length})</h3><div className="mt-3 divide-y">{lectures.map((l,i)=><div key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{i+1}. {l.title}</p><p className="mt-1 text-xs text-slate-500">{l.r2ObjectKey?"Private R2 video":l.youtubeId?"YouTube video":"No video attached"} · {l.trialEnabled?"Trial enabled":"Enrollment required"}</p></div><div className="flex gap-2"><button onClick={()=>setLecture({...l,trialEnabled:Boolean(l.trialEnabled),freePreview:Boolean(l.freePreview)})} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">Edit</button><button onClick={()=>deleteLecture(l)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700"><Trash2 size={16}/></button></div></div>)}</div></section>}</div>}
 {tab==="enrollments"&&<div className="space-y-6"><section className="rounded-2xl border bg-white p-6"><h2 className="text-2xl font-extrabold">Grant student access</h2><p className="mt-2 text-sm text-slate-600">Students buying a master course automatically unlock its included courses. Here you can also grant access manually.</p><form onSubmit={grantAccess} className="mt-6 grid gap-4 sm:grid-cols-2"><Label>Student email<input type="email" required className={input} value={grant.email} onChange={e=>setGrant(v=>({...v,email:e.target.value}))}/></Label><Label>Course<select required className={input} value={grant.courseId} onChange={e=>setGrant(v=>({...v,courseId:e.target.value}))}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Label><Label>Expiry (optional)<input type="date" className={input} value={grant.expiresAt} onChange={e=>setGrant(v=>({...v,expiresAt:e.target.value}))}/></Label><div className="flex items-end"><button disabled={busy} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Grant access</button></div></form></section><section className="rounded-2xl border bg-white p-6"><h3 className="text-xl font-extrabold">Free trial access is automatic</h3><p className="mt-2 text-sm leading-6 text-slate-600">Every signed-in student can watch lessons marked <strong>Free trial</strong>. There is no manual activation, expiry date or enrollment requirement for those lessons. In Video lessons, edit a lecture and enable its Free trial checkbox. Other paid lessons remain locked.</p><button type="button" onClick={()=>setTab("lectures")} className="mt-4 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800">Manage trial lessons</button></section><section className="rounded-2xl border bg-white p-6"><h3 className="text-xl font-extrabold">Student enrollments ({enrollments.length})</h3><div className="mt-4 space-y-3">{enrollments.map(g=><div key={g.userId+"/"+g.courseId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="text-sm font-bold">{g.email}</p><p className="mt-1 text-xs text-slate-500">{g.title} · {g.source} · {g.expiresAt?"Until "+readableDate(g.expiresAt):"Lifetime"}</p></div><button onClick={()=>revoke(g)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Revoke</button></div>)}</div></section></div>}
 {tab==="team"&&isOwner&&<div className="space-y-6">
  <section className="rounded-2xl border bg-white p-6">
   <h2 className="text-2xl font-extrabold">Admin Access Manager</h2>
   <p className="mt-2 text-sm leading-6 text-slate-600">Give anyone admin access using their email address. They must verify that email by signing in before they can use the Admin Panel. Only you (the owner) can add admins, edit their permissions or remove admin access. Other admins can never manage or delete the owner account.</p>
   <form onSubmit={addStaff} className="mt-6 space-y-4">
    <Label>Admin email<input type="email" className={input} required maxLength={254} autoComplete="email" readOnly={!!editingStaffId} value={staffForm.email} placeholder="name@example.com" onChange={e=>setStaffForm(v=>({...v,email:e.target.value}))}/></Label>
    <div><p className="mb-2 text-sm font-bold text-slate-700">Choose permissions</p><div className="grid gap-2 sm:grid-cols-2">
     {permissionOptions.map(([permission,label])=><label key={permission} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
      <input type="checkbox" className="mt-1" checked={staffForm.permissions.includes(permission)}
       onChange={e=>setStaffForm(v=>({...v,permissions:e.target.checked?[...v.permissions,permission]:v.permissions.filter(p=>p!==permission)}))}/>{label}
     </label>)}
    </div></div>
    <p className="text-xs text-slate-500">Full operational admin: select all five permissions. Student management can be delegated, but the owner and other active admin accounts remain protected. Only the owner can manage the Team.</p>
    <div className="flex flex-wrap gap-3">
     <button disabled={busy||!staffForm.permissions.length} className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{editingStaffId?"Update permissions":"Give admin access"}</button>
     {editingStaffId&&<button type="button" onClick={()=>{setEditingStaffId("");setStaffForm({email:"",permissions:[...defaultAdminPermissions]})}} className="rounded-xl border px-5 py-3 text-sm font-semibold">Cancel edit</button>}
    </div>
   </form>
  </section>
  <section className="rounded-2xl border bg-white p-6">
   <h3 className="text-xl font-extrabold">Current admins ({staff.filter(s=>s.role!=="owner"&&s.active===1).length})</h3>
   <p className="mt-2 text-xs text-slate-500">Removing an admin stops admin permissions immediately on the server. It does not delete their student account.</p>
   <div className="mt-4 divide-y">
    {staff.map(s=><div key={s.userId} className="flex flex-wrap items-center justify-between gap-3 py-4">
     <div className="min-w-0 flex-1">
      <p className="break-all text-sm font-extrabold text-slate-900">{s.email}{s.role==="owner"&&<span className="ml-2 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-800">Protected owner</span>}</p>
      <p className="mt-1 text-xs text-slate-600">{s.role==="owner"?"Full owner control":s.permissions.join(" · ")}{s.authProvider==="pending_otp"?" · Pending email sign-in":""}</p>
     </div>
     {s.role!=="owner"&&<div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={()=>editStaff(s)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-40">Edit permissions</button>
      <button disabled={busy} onClick={()=>removeStaff(s)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40">Remove admin</button>
     </div>}
    </div>)}
    {!staff.length&&<p className="py-5 text-sm text-slate-500">No admin accounts found.</p>}
   </div>
  </section>
 </div>}
 </main></div></div>;
}
