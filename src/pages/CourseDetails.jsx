import CourseThumbnail from "../components/CourseThumbnail.jsx";
import RazorpayCheckout from "../components/RazorpayCheckout.jsx";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../services/firebase.js";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock3, Gift, Layers3, LockKeyhole, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";

const formatPrice=value=>Number(value)>0?"₹"+Number(value).toLocaleString("en-IN"):"Free";
const sortLessons=items=>items.sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||(a.title||"").localeCompare(b.title||""));

function CurriculumSection({item,index}){
 const [open,setOpen]=useState(index===0);
 return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <button type="button" onClick={()=>setOpen(x=>!x)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5">
   <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-extrabold text-blue-800">{String(index+1).padStart(2,"0")}</span>
   <span className="min-w-0 flex-1"><span className="block text-base font-extrabold text-slate-950 sm:text-lg">{item.title}</span><span className="mt-1 block text-xs font-medium text-slate-500">{item.lessons.length} video lessons {item.bonus?"· Included free with main course":"· Main course"}</span></span>
   <ChevronDown size={20} className={"shrink-0 text-slate-500 transition-transform "+(open?"rotate-180":"")}/>
  </button>
  {open&&<div className="border-t border-slate-100 px-4 pb-3 sm:px-5">{item.lessons.length?item.lessons.map((lesson,i)=><div key={lesson.id} className="flex items-start gap-3 border-b border-slate-100 py-3.5 last:border-0"><PlayCircle size={18} className="mt-0.5 shrink-0 text-blue-600"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{i+1}. {lesson.title||"Lesson"}</p><p className="mt-1 text-xs text-slate-500">{lesson.trialEnabled?"Trial lesson available to eligible students":lesson.freePreview?"Preview lesson":"Available after enrollment"}</p></div>{lesson.trialEnabled?<span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">TRIAL</span>:<LockKeyhole size={15} className="mt-1 shrink-0 text-slate-400"/>}</div>):<p className="py-5 text-sm text-slate-500">Lessons will appear here when the instructor publishes the syllabus.</p>}</div>}
 </div>;
}

export default function CourseDetails(){
 const {courseId}=useParams();
 const [course,setCourse]=useState(null),[included,setIncluded]=useState([]),[sections,setSections]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");(async()=>{try{
  const snap=await getDoc(doc(db,"courses",courseId));
  if(!snap.exists()||snap.data().published!==true)throw Error("This course is not available.");
  const data={id:snap.id,...snap.data()};
  const children=await Promise.all((data.includedCourseIds||[]).map(async id=>{try{const child=await getDoc(doc(db,"courses",id));return child.exists()?{id:child.id,...child.data()}:null}catch{return null}}));
  const bundles=children.filter(Boolean);
  const curricula=await Promise.all([data,...bundles].map(async (item,index)=>{try{const snapshot=await getDocs(collection(db,"courses",item.id,"lectureCatalog"));return {id:item.id,title:item.title,bonus:index>0,lessons:sortLessons(snapshot.docs.map(d=>({id:d.id,...d.data()})))} }catch{return {id:item.id,title:item.title,bonus:index>0,lessons:[]}}}));
  if(active){setCourse(data);setIncluded(bundles);setSections(curricula)}
 }catch(e){if(active)setError(e.message||"Could not load course.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[courseId]);
 if(loading)return <div className="mx-auto max-w-5xl px-5 py-20 text-center text-slate-600">Loading your learning path…</div>;
 if(error||!course)return <div className="mx-auto max-w-5xl px-5 py-20"><p className="text-red-700">{error}</p><Link to="/courses" className="mt-4 inline-block font-bold text-blue-700">Browse courses</Link></div>;
 const total=sections.reduce((sum,item)=>sum+item.lessons.length,0),bonuses=sections.filter(x=>x.bonus).length;
 return <div className="min-h-[80vh] bg-slate-50">
  <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-5 py-12 text-white sm:py-20">
   <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"/>
   <div className="relative mx-auto max-w-6xl"><Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-sky-300 hover:text-white"><ArrowLeft size={16}/> All courses</Link>
    <div className="mt-8 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
     <div><span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs font-extrabold uppercase tracking-widest text-sky-200"><Sparkles size={15}/>{course.track||"Technology career path"}</span>
      <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{course.title}</h1><p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-blue-100">{course.description||"Master the fundamentals with a structured, practical learning path."}</p>
      <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-100 sm:text-sm"><span className="rounded-full bg-white/10 px-4 py-2">{sections.length} learning modules</span><span className="rounded-full bg-white/10 px-4 py-2">{total} video lessons</span>{bonuses>0&&<span className="rounded-full bg-emerald-400/20 px-4 py-2 text-emerald-200">{bonuses} bonus courses included</span>}</div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-blue-100">{course.level&&<span>{course.level}</span>}{course.duration&&<span className="inline-flex items-center gap-2"><Clock3 size={16}/>{course.duration}</span>}{course.language&&<span>{course.language}</span>}</div>
     </div>
     <div className="aspect-video overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl"><CourseThumbnail src={course.thumbnail} alt={course.title}/></div>
    </div>
   </div>
  </section>
  <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_330px]">
   <main className="min-w-0 space-y-8">
    <section className="rounded-2xl border bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-100 p-3 text-blue-700"><BookOpen size={24}/></span><h2 className="text-2xl font-extrabold text-slate-950">What you'll learn</h2></div><p className="mt-5 whitespace-pre-line leading-7 text-slate-600">{course.description||"Follow a clear path from foundational skills to advanced technical concepts."}</p>{course.instructor&&<p className="mt-5 text-sm text-slate-600">Instructor: <strong>{course.instructor}</strong></p>}</section>
    {included.length>0&&<section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"><div className="flex items-center gap-3"><Gift className="text-emerald-700" size={26}/><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Bundle benefits</p><h2 className="mt-1 text-2xl font-extrabold text-slate-950">Bonus courses included free</h2></div></div><p className="mt-3 text-sm leading-6 text-emerald-950">Enroll in {course.title} and get access to the complete lessons of these courses at no additional charge.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{included.map(item=><div key={item.id} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-4"><CheckCircle2 className="shrink-0 text-emerald-700" size={22}/><div><p className="font-extrabold text-slate-950">{item.title}</p><p className="mt-1 text-xs text-emerald-800">{sections.find(s=>s.id===item.id)?.lessons.length||0} lessons · Included free</p></div></div>)}</div></section>}
    <section id="curriculum"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Complete syllabus</p><h2 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">Your learning roadmap</h2><p className="mt-2 text-sm text-slate-600">Explore all {total} lessons across {sections.length} course modules before enrolling.</p></div><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><Layers3 size={17}/>{sections.length} modules</span></div><div className="space-y-3">{sections.map((item,i)=><CurriculumSection key={item.id} item={item} index={i}/>)}</div></section>
    <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-6"><ShieldCheck className="text-blue-700" size={26}/><h3 className="mt-3 text-lg font-extrabold">Access-controlled learning</h3><p className="mt-2 text-sm leading-6 text-slate-600">Full paid lectures unlock only after approved enrollment. Eligible trial students can access selected trial lessons.</p></div><div className="rounded-2xl border bg-white p-6"><CheckCircle2 className="text-emerald-700" size={26}/><h3 className="mt-3 text-lg font-extrabold">Track your progress</h3><p className="mt-2 text-sm leading-6 text-slate-600">Follow lessons in order, navigate between videos and see your completed lessons.</p></div></section>
   </main>
   <aside className="self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-lg lg:sticky lg:top-24"><p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Complete learning bundle</p><p className="mt-3 text-4xl font-extrabold text-slate-950">{course.status==="comingSoon"?"Coming soon":formatPrice(course.price)}</p><p className="mt-2 text-sm text-slate-600">One course enrollment includes {sections.length} learning modules and {total} lessons.</p><div className="mt-6 space-y-3 border-t pt-5 text-sm text-slate-700"><p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600"/> Main course lectures</p>{bonuses>0&&<p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600"/> {bonuses} bonus courses at no extra cost</p>}<p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600"/> Lesson-by-lesson curriculum</p><p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600"/> Learning progress tracking</p></div>{Number(course.price)>0&&<RazorpayCheckout course={course}/>}<Link to={"/learn/"+encodeURIComponent(course.id)} className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-5 py-3.5 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50">View lessons / Trial <ArrowRight size={18}/></Link><a href="#curriculum" className="mt-3 flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">Explore full syllabus</a><p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={15} className="mt-0.5 shrink-0"/> Paid access is activated after verified payment. Existing administrator-assigned access continues to work.</p></aside>
  </div>
 </div>;
}
