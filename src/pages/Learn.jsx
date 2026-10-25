import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase.js";
import { useAuth } from "../services/AuthProvider.jsx";
import { PlayCircle, ArrowLeft, ArrowRight, ChevronLeft, CheckCircle2, LockKeyhole, BookOpen } from "lucide-react";

let youtubeApiPromise;
function loadYouTubeApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!youtubeApiPromise)youtubeApiPromise=new Promise((resolve,reject)=>{
  const existing=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{existing?.();resolve(window.YT)};
  if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";s.onerror=()=>reject(Error("YouTube player could not load"));document.head.appendChild(s)}
 });
 return youtubeApiPromise;
}
function VideoPlayer({videoId,lectureId,courseId,userId,onComplete}){
 const target=useRef(null),player=useRef(null),last=useRef(null),watched=useRef(0),saved=useRef(false);
 useEffect(()=>{let active=true,interval;watched.current=0;last.current=null;saved.current=false;
 loadYouTubeApi().then(YT=>{if(!active||!target.current)return;
  player.current=new YT.Player(target.current,{videoId,playerVars:{rel:0,playsinline:1,modestbranding:1,origin:window.location.origin},events:{onStateChange:e=>{if(e.data!==YT.PlayerState.PLAYING)last.current=null}}});
  interval=window.setInterval(async()=>{const p=player.current;if(!p||typeof p.getPlayerState!=="function")return;
   try{const duration=p.getDuration(),current=p.getCurrentTime(),state=p.getPlayerState();
    if(state===YT.PlayerState.PLAYING&&duration>0){if(last.current!==null){const delta=current-last.current;if(delta>0&&delta<=2.5)watched.current+=delta}last.current=current}else last.current=null;
    if(!saved.current&&duration>0&&watched.current>=duration*0.9){saved.current=true;try{await setDoc(doc(db,"lessonProgress",userId+"_"+courseId+"_"+lectureId),{userId,courseId,lectureId,completed:true,watchedSeconds:Math.round(watched.current),duration:Math.round(duration),completedAt:serverTimestamp()});if(active)onComplete(lectureId)}catch{saved.current=false}}
   }catch{}
  },1000);
 }).catch(()=>{});
 return()=>{active=false;window.clearInterval(interval);try{player.current?.destroy()}catch{}player.current=null}
 },[videoId,lectureId,courseId,userId,onComplete]);
 return <div className="aspect-video w-full bg-slate-950"><div ref={target} className="h-full w-full"/></div>;
}
export default function Learn(){
 const {courseId}=useParams(),{user,loading:authLoading}=useAuth();
 const [isTrial,setIsTrial]=useState(false),[hasAccess,setHasAccess]=useState(false),[videoId,setVideoId]=useState(""),[course,setCourse]=useState(null),[lectures,setLectures]=useState([]),[selected,setSelected]=useState(""),[completed,setCompleted]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{if(authLoading)return;let active=true;if(!user){setLoading(false);return}setLoading(true);setError("");(async()=>{try{
  const grant=await getDoc(doc(db,"enrollments",user.uid+"_"+courseId));let enrolled=grant.exists()&&grant.data().userId===user.uid&&grant.data().courseId===courseId;
  const courseDoc=await getDoc(doc(db,"courses",courseId));if(!courseDoc.exists())throw Error("Course not found.");
  if(!enrolled){const parentId=(courseDoc.data().includedInCourseIds||[])[0];if(parentId){const parentGrant=await getDoc(doc(db,"enrollments",user.uid+"_"+parentId));enrolled=parentGrant.exists()&&parentGrant.data().userId===user.uid&&parentGrant.data().courseId===parentId}}
  const profile=await getDoc(doc(db,"users",user.uid));const expiry=profile.data()?.trialExpiresAt;const trial=!enrolled&&Boolean(expiry?.toMillis&&expiry.toMillis()>Date.now());
  const catalog=await getDocs(collection(db,"courses",courseId,"lectureCatalog"));const items=catalog.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0)||a.title.localeCompare(b.title));
  const first=items.find(l=>enrolled||l.freePreview===true||(trial&&l.trialEnabled===true));
  const progress={};if(enrolled){const progressDocs=await Promise.all(items.map(l=>getDoc(doc(db,"lessonProgress",user.uid+"_"+courseId+"_"+l.id)).catch(()=>null)));progressDocs.forEach((d,i)=>{if(d?.exists()&&d.data().completed===true)progress[items[i].id]=true})}
  if(active){setHasAccess(enrolled);setIsTrial(trial);setCourse({id:courseDoc.id,...courseDoc.data()});setLectures(items);setSelected(first?.id||"");setCompleted(progress)}
 }catch(e){if(active)setError(e.message||"Could not load your lessons. Check Firestore permissions.")}
 finally{if(active)setLoading(false)}})();return()=>{active=false}},[user,courseId,authLoading]);
 const canPlay=l=>Boolean(l&&(hasAccess||l.freePreview===true||(isTrial&&l.trialEnabled===true)));
 useEffect(()=>{const l=lectures.find(x=>x.id===selected);setVideoId("");if(!user||!selected||!canPlay(l))return;let active=true;getDoc(doc(db,"courses",courseId,"lectures",selected)).then(s=>{if(active)setVideoId(s.data()?.youtubeId||"")}).catch(()=>{});return()=>{active=false}},[user,selected,courseId,hasAccess,isTrial,lectures]);
 if(authLoading||loading)return <div className="mx-auto max-w-5xl px-6 py-20 text-center">Loading your classroom…</div>;
 if(!user)return <div className="mx-auto max-w-4xl px-6 py-20"><h1 className="text-3xl font-bold">Sign in to learn</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-blue-700 px-6 py-3 font-bold text-white">Sign in</Link></div>;
 if(error)return <div className="mx-auto max-w-4xl px-6 py-20"><LockKeyhole className="text-amber-600"/><h1 className="mt-3 text-2xl font-bold">Course access unavailable</h1><p className="mt-3 text-slate-600">{error}</p><Link to="/dashboard" className="mt-5 inline-block text-blue-700 underline">Back to dashboard</Link></div>;
 const current=lectures.find(x=>x.id===selected),index=lectures.findIndex(x=>x.id===selected),playable=canPlay(current),validId=playable&&/^[a-zA-Z0-9_-]{11}$/.test(videoId),done=lectures.filter(l=>completed[l.id]).length;
 const go=i=>{if(i>=0&&i<lectures.length){setSelected(lectures[i].id);setVideoId("")}};
 return <div className="min-h-[75vh] bg-slate-50"><div className="bg-slate-950 px-5 py-10 text-white"><div className="mx-auto max-w-7xl"><Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-sky-300"><ArrowLeft size={16}/> My Learning</Link><p className="mt-5 text-sm font-bold uppercase tracking-widest text-sky-300">{course?.track||"Course"}</p><h1 className="mt-2 text-2xl font-extrabold sm:text-4xl">{course?.title}</h1><p className="mt-2 text-slate-300">{lectures.length} lessons · {hasAccess?"Enrolled":isTrial?"Free trial preview":"Locked course preview"}</p>{hasAccess&&<div className="mt-5 max-w-md"><div className="mb-2 flex justify-between text-xs"><span>Your progress</span><span>{done}/{lectures.length} completed</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{width:(lectures.length?done/lectures.length*100:0)+"%"}}/></div></div>}</div></div><div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_330px]"><main className="min-w-0"><div className="overflow-hidden rounded-2xl bg-slate-950 shadow-xl">{validId?<VideoPlayer key={selected} videoId={videoId} lectureId={selected} courseId={courseId} userId={user.uid} onComplete={id=>setCompleted(prev=>({...prev,[id]:true}))}/>:<div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center text-slate-300"><BookOpen size={40}/><p>{!lectures.length?"No lectures have been added yet.":playable?"Loading lesson video…":"This lesson is locked. Enrollment is required."}</p></div>}</div>{current&&<div className="mt-5 rounded-2xl border bg-white p-5 sm:p-7"><p className="text-xs font-bold tracking-widest text-blue-700">LESSON {index+1} OF {lectures.length}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h2 className="text-xl font-extrabold sm:text-2xl">{current.title}</h2>{completed[current.id]&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Completed</span>}</div><p className="mt-3 text-sm leading-6 text-slate-500">A lesson is marked complete after you watch at least 90% of its playback. Skipping ahead does not count as watched time.</p><div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-5"><button disabled={index<=0} onClick={()=>go(index-1)} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={18}/> Previous</button><button disabled={index<0||index>=lectures.length-1} onClick={()=>go(index+1)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Next lesson <ArrowRight size={18}/></button></div></div>}</main><aside className="self-start overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-extrabold">Course lessons</h2><p className="mt-1 text-sm text-slate-500">{done} completed of {lectures.length}</p></div><div className="max-h-[65vh] overflow-y-auto p-3">{lectures.map((l,i)=><button key={l.id} onClick={()=>go(i)} className={"mb-2 flex w-full items-center gap-3 rounded-xl p-4 text-left transition "+(selected===l.id?"bg-blue-700 text-white":"hover:bg-slate-100")}><span className="shrink-0">{completed[l.id]?<CheckCircle2 size={22} className={selected===l.id?"text-emerald-200":"text-emerald-600"}/>:canPlay(l)?<PlayCircle size={22}/>:<LockKeyhole size={21}/>}</span><span className="min-w-0"><span className="block text-xs opacity-75">Lesson {i+1}</span><span className="block break-words text-sm font-bold">{l.title||"Untitled lesson"} {!canPlay(l)&&<span className="text-xs opacity-70">· Locked</span>}</span></span></button>)}{!lectures.length&&<p className="p-4 text-sm text-slate-500">No lessons available yet.</p>}</div></aside></div></div>;
}
