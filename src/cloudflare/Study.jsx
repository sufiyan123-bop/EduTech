import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {api} from "./api.js";
import {useAuth} from "./Auth.jsx";
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,Clock3,LockKeyhole,PlayCircle} from "lucide-react";
let youtubeReady;
function youtubeApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!youtubeReady)youtubeReady=new Promise((resolve,reject)=>{
  const prev=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{prev?.();resolve(window.YT)};
  if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){
   const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.onerror=()=>reject(Error("YouTube unavailable"));document.head.appendChild(script)
  }
 });return youtubeReady;
}
function YoutubeVideo({youtubeId,onWatched}){
 const node=useRef(null),player=useRef(null),callback=useRef(onWatched),[error,setError]=useState("");
 callback.current=onWatched;
 useEffect(()=>{
  let active=true,timer,previous=null,watched=0,sent=false;
  youtubeApi().then(YT=>{if(!active||!node.current)return;
   player.current=new YT.Player(node.current,{videoId:youtubeId,host:"https://www.youtube-nocookie.com",playerVars:{playsinline:1,rel:0,origin:window.location.origin},
    events:{onError:()=>setError("The video owner has disabled embedding or this video is unavailable.")}});
   timer=setInterval(()=>{try{
    const p=player.current,duration=p?.getDuration?.(),time=p?.getCurrentTime?.(),state=p?.getPlayerState?.();
    if(state===YT.PlayerState.PLAYING&&duration>0){
     if(previous!==null){const delta=time-previous;if(delta>0&&delta<=2.5)watched+=delta}
     previous=time;
     if(!sent&&watched>=duration*.9){sent=true;callback.current(watched)}
    }else previous=null;
   }catch{}},1000);
  }).catch(()=>setError("Could not load YouTube playback."));
  return()=>{active=false;clearInterval(timer);try{player.current?.destroy()}catch{};player.current=null};
 },[youtubeId]);
 return <div className="relative aspect-video bg-slate-950"><div ref={node} className="h-full w-full"/>{error&&<p role="alert" className="absolute bottom-2 left-2 right-2 bg-slate-900 p-3 text-center text-sm text-amber-200">{error}</p>}</div>;
}
// Visible per-learner watermark deters sharing of screen recordings. It is not DRM:
 // a determined viewer can still record or alter their own browser.
function LearnerWatermark({user}){
 const [tick,setTick]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setTick(v=>v+1),17000);return()=>clearInterval(timer)},[]);
 const placement=[
  "top-5 left-4 sm:top-8 sm:left-8",
  "top-5 right-4 sm:top-8 sm:right-8",
  "bottom-12 right-4 sm:bottom-16 sm:right-8",
  "bottom-12 left-4 sm:bottom-16 sm:left-8"
 ][tick%4];
 const visibleAt=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
 return <div className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden" aria-hidden="true">
  <span className={"absolute max-w-[78%] rounded-md bg-slate-950/40 px-2.5 py-1.5 text-[10px] font-bold leading-4 text-white/70 shadow-sm sm:text-xs "+placement}>
   InfraRivet Academy · {user?.email||"Authorized student"} · {visibleAt}
  </span>
  <span className="absolute bottom-2 left-3 max-w-[85%] truncate text-[9px] font-semibold tracking-wide text-white/40 sm:text-[10px]">
   PRIVATE LEARNING ACCESS · {user?.email||"SIGNED-IN VIEWER"}
  </span>
 </div>;
}
function R2Video({url,onWatched}){
 const tracked=useRef({last:null,seconds:0,done:false}),callback=useRef(onWatched);
 callback.current=onWatched;
 return <video key={url} controls playsInline preload="metadata" controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback onContextMenu={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()} draggable={false} className="aspect-video w-full select-none bg-slate-950"
  src={url} onTimeUpdate={e=>{
   const v=e.currentTarget,t=tracked.current;
   if(!v.duration||v.paused)return;
   if(t.last!==null){const delta=v.currentTime-t.last;if(delta>0&&delta<3)t.seconds+=delta}
   t.last=v.currentTime;
   if(!t.done&&t.seconds>=v.duration*.9){t.done=true;callback.current(t.seconds)}
  }} onSeeking={()=>{tracked.current.last=null}} onPause={()=>{tracked.current.last=null}} onError={()=>{tracked.current.last=null}}/>;
}
export function Study(){
 const {courseId}=useParams(),{user,loading:authLoading}=useAuth();
 const [data,setData]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(""),[active,setActive]=useState(""),[open,setOpen]=useState({}),[video,setVideo]=useState(null),[videoError,setVideoError]=useState(""),[saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!user)return;
  let alive=true;setBusy(true);setError("");setActive("");setData(null);
  api("/api/learn/"+encodeURIComponent(courseId)).then(d=>{
   if(!alive)return;setData(d);const first=d.modules.flatMap(m=>m.lessons.map(l=>({...l,courseId:m.id}))).find(l=>!l.locked);
   setActive(first?first.courseId+"/"+first.id:"");
   setOpen(Object.fromEntries(d.modules.map((m,i)=>[m.id,i===0||m.id===first?.courseId])));
  }).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setBusy(false)});
  return()=>{alive=false}
 },[courseId,user?.id]);
 const all=useMemo(()=>data?.modules.flatMap(m=>m.lessons.map(l=>({...l,courseId:m.id,courseTitle:m.title})))||[],[data]);
 const current=all.find(l=>l.courseId+"/"+l.id===active),index=all.findIndex(l=>l.courseId+"/"+l.id===active);
 const done=all.filter(l=>l.completed).length,percent=all.length?Math.round(done/all.length*100):0;
 useEffect(()=>{
  let alive=true;setVideo(null);setVideoError("");
  if(!current||current.locked)return;
  api("/api/watch/"+encodeURIComponent(current.courseId)+"/"+encodeURIComponent(current.id))
   .then(d=>{if(alive)setVideo(d)}).catch(e=>{if(alive)setVideoError(e.message)});
  return()=>{alive=false};
 },[current?.courseId,current?.id,current?.locked]);
 const finish=useCallback(async(manual=false,seconds=0)=>{
  if(!current||current.completed||saving)return;
  setSaving(true);setVideoError("");
  try{
   await api("/api/progress",{method:"POST",body:{courseId:current.courseId,lectureId:current.id,manual,watchedSeconds:seconds}});
   setData(prev=>({...prev,modules:prev.modules.map(m=>m.id!==current.courseId?m:{...m,lessons:m.lessons.map(l=>l.id!==current.id?l:{...l,completed:true})})}));
  }catch(e){setVideoError(e.message)}finally{setSaving(false)}
 },[current?.courseId,current?.id,current?.completed,saving]);
 function choose(l){setActive(l.courseId+"/"+l.id);window.scrollTo?.({top:0,behavior:"smooth"})}
 if(authLoading||busy)return <div className="mx-auto max-w-6xl px-5 py-24 text-center text-slate-600">Loading your classroom…</div>;
 if(!user)return <div className="mx-auto max-w-4xl px-5 py-24 text-center"><h1 className="text-3xl font-extrabold">Sign in to learn</h1><Link className="mt-5 inline-block rounded-xl bg-blue-700 px-6 py-3 font-bold text-white" to="/login">Sign in</Link></div>;
 if(error)return <div className="mx-auto max-w-5xl px-5 py-20"><h1 className="text-2xl font-extrabold">Classroom unavailable</h1><p className="mt-2 text-red-700">{error}</p><Link className="mt-4 inline-block text-blue-700 underline" to="/dashboard">Back to dashboard</Link></div>;
 return <div className="min-h-[85vh] bg-[#f4f6fa]"><div className="bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-7 text-white"><div className="mx-auto max-w-[1500px]"><Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-sky-300"><ArrowLeft size={16}/> My Learning</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-extrabold uppercase tracking-widest text-sky-300">Your learning classroom</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{data?.course.title}</h1><p className="mt-1 text-sm text-slate-300">{data?.modules.length} course modules · {all.length} lessons</p></div><div className="w-full max-w-xs rounded-xl border border-white/15 bg-white/10 p-3"><div className="flex justify-between text-xs font-bold"><span>Your progress</span><span>{done}/{all.length} · {percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-400" style={{width:percent+"%"}}/></div></div></div></div></div>
 <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 lg:grid-cols-[345px_minmax(0,1fr)]">
 <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"><div className="border-b p-5"><h2 className="text-lg font-extrabold">Course contents</h2><p className="mt-1 text-xs text-slate-500">Choose a course, then a video lesson</p></div><div className="divide-y divide-slate-100">{data.modules.map((module,i)=>{
  const count=module.lessons.filter(l=>l.completed).length;
  return <div key={module.id}><button className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50" onClick={()=>setOpen(s=>({...s,[module.id]:!s[module.id]}))}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-extrabold text-blue-800">{i+1}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{module.title}</strong><span className="mt-1 block text-xs text-slate-500">{count}/{module.lessons.length} studied</span></span><ChevronDown size={17} className={"text-slate-500 transition "+(open[module.id]?"rotate-180":"")}/></button>{open[module.id]&&<div className="pb-3">{module.lessons.length?module.lessons.map((l,j)=>{const selected=active===module.id+"/"+l.id;return <div key={l.id}>{(j===0||(module.lessons[j-1]?.chapter||"General")!==(l.chapter||"General"))&&<p className="bg-slate-50 px-6 py-2 text-[11px] font-extrabold uppercase tracking-wide text-blue-700">{l.chapter||"General"}</p>}<button onClick={()=>choose({...l,courseId:module.id})} className={"flex w-full items-start gap-3 border-l-4 px-5 py-3 text-left transition "+(selected?"border-blue-600 bg-blue-50":"border-transparent hover:bg-slate-50")}><span className="mt-0.5 shrink-0">{l.completed?<CheckCircle2 size={18} className="text-emerald-600"/>:l.locked?<LockKeyhole size={17} className="text-slate-400"/>:<PlayCircle size={18} className="text-blue-600"/>}</span><span className="min-w-0 flex-1"><span className={"block text-sm "+(selected?"font-bold text-blue-900":"text-slate-700")}>{j+1}. {l.title}</span>{l.locked?<span className="mt-1 block text-[11px] text-amber-700">Requires enrollment</span>:l.completed?<span className="mt-1 block text-[11px] font-bold text-emerald-700">Studied ✓</span>:l.trialEnabled?<span className="mt-1 block text-[11px] text-emerald-700">Trial lesson</span>:null}</span></button></div>}):<p className="px-6 pb-3 text-xs text-slate-400">Lessons coming soon</p>}</div>}</div>
 })}</div></aside>
 <main className="min-w-0 space-y-5"><div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-xl" onContextMenu={e=>e.preventDefault()}>{!current?<div className="flex aspect-video flex-col items-center justify-center gap-3 text-slate-300"><BookOpen size={42}/><p>No lessons are available yet.</p></div>:current.locked?<div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center text-slate-300"><LockKeyhole size={42}/><p>This lesson is locked. Enroll in the master course to unlock included videos.</p><Link to={"/courses/"+encodeURIComponent(courseId)} className="font-bold text-sky-300">View course plans</Link></div>:!video?<div className="flex aspect-video flex-col items-center justify-center text-slate-300">{videoError||"Loading video…"}</div>:video.provider==="r2"?<R2Video key={active} url={video.url} onWatched={seconds=>finish(false,seconds)}/>:<YoutubeVideo key={active} youtubeId={video.youtubeId} onWatched={seconds=>finish(false,seconds)}/>} {video&&!current?.locked&&<LearnerWatermark user={user}/>}</div>
 {video&&<p className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-600"><LockKeyhole size={15}/> Private classroom: learner-watermarked playback. Copying, recording or redistributing lessons is not permitted.</p>}{current&&<section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">{current.courseTitle} · Lesson {index+1} of {all.length}</p><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><h2 className="text-xl font-extrabold sm:text-2xl">{current.title}</h2>{current.completed&&<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={16}/> Studied</span>}</div><p className="mt-3 text-sm leading-6 text-slate-600">Finish watching or mark this lecture as studied to update your course progress.</p>{videoError&&<p role="alert" className="mt-3 text-sm text-red-700">{videoError}</p>}<div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button disabled={current.locked||current.completed||saving} onClick={()=>finish(true,0)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={18}/>{current.completed?"Studied":saving?"Saving...":"Mark as studied"}</button><div className="flex items-center gap-2"><button disabled={index<=0} onClick={()=>choose(all[index-1])} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">Previous</button><button disabled={index<0||index>=all.length-1} onClick={()=>choose(all[index+1])} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Next <ArrowRight size={17}/></button></div></div></section>}
 </main></div></div>;
}
