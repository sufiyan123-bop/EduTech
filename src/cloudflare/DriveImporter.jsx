import {useCallback,useEffect,useRef,useState} from "react";
import {api} from "./api.js";
import {CloudDownload,FolderInput,PauseCircle,PlayCircle,RefreshCw,ShieldCheck} from "lucide-react";

const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.readonly";
const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-blue-600";
const size=n=>Number(n)>0?(Number(n)/1024/1024).toFixed(1)+" MB":"—";

export default function DriveImporter({courseId,courses,onImported}){
 const [clientId,setClientId]=useState(""),[oauthReady,setOauthReady]=useState(false);
 const clientRef=useRef(null),tokenRef=useRef(""),expiryRef=useRef(0),runningRef=useRef(false),pauseRef=useRef(false);
 const [connected,setConnected]=useState(false),[folderUrl,setFolderUrl]=useState("");
 const [files,setFiles]=useState([]),[folder,setFolder]=useState(null);
 const [jobs,setJobs]=useState([]),[busy,setBusy]=useState(false),[running,setRunning]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[progress,setProgress]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [bulkTitles,setBulkTitles]=useState("");
 const destination=courses.find(c=>c.id===courseId);

 const loadJobs=useCallback(async()=>{
  if(!courseId)return;
  try{const x=await api("/api/admin/drive/imports?courseId="+encodeURIComponent(courseId));setJobs(x.jobs||[])}
  catch(e){setError(e.message)}
 },[courseId]);
 useEffect(()=>{setFiles([]);setFolder(null);setConfirmed(false);setProgress("");setError("");setMessage("");loadJobs()},[loadJobs]);
 useEffect(()=>{
  let alive=true,script;
  (async()=>{
   try{
    const response=await api("/api/public-config");
    if(!alive)return;
    setClientId(response.googleClientId||"");
    if(!response.googleClientId)return;
    const initialize=()=>{
     if(!alive||!window.google?.accounts?.oauth2)return;
     clientRef.current=window.google.accounts.oauth2.initTokenClient({
      client_id:response.googleClientId,scope:DRIVE_SCOPE,
      callback:result=>{
       if(!alive)return;
       if(!result?.access_token){setError(result?.error||"Google Drive permission was not granted");return;}
       tokenRef.current=result.access_token;
       expiryRef.current=Date.now()+Math.max(0,Number(result.expires_in||3600)-90)*1000;
       setConnected(true);setError("");setMessage("Google Drive connected with read-only permission.");
      }
     });
     setOauthReady(true);
    };
    if(window.google?.accounts?.oauth2)initialize();
    else{
     script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";
     script.async=true;script.onload=initialize;script.onerror=()=>{if(alive)setError("Google connection script could not load.")};
     document.head.appendChild(script);
    }
   }catch(e){if(alive)setError(e.message)}
  })();
  return()=>{alive=false;script?.remove()};
 },[]);
 function applyBulkTitles(){
  const lines=bulkTitles.split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
  if(!lines.length){setError("Paste one or more lecture titles first.");return}
  const numbered=new Map();
  for(const line of lines){
   const match=line.match(/#\s*(\d+)/);
   if(match)numbered.set(Number(match[1]),line);
  }
  const selected=files.filter(f=>f.selected),allNumbered=numbered.size===lines.length;
  if(!allNumbered&&selected.length!==lines.length){
   setError("Paste exactly "+selected.length+" titles, or use '#39' format to match lecture numbers.");
   return;
  }
  let cursor=0,matches=0;
  const updated=files.map(f=>{
   if(!f.selected)return f;
   const n=f.name.match(/(?:lecture|tutorial|lesson|part)\s*#?\s*(\d+)/i)?.[1];
   const title=allNumbered&&n?numbered.get(Number(n)):(allNumbered?null:lines[cursor++]);
   if(!title)return f;
   matches++;return {...f,title:title.slice(0,220)};
  });
  if(!matches){setError("No matching video numbers found. Check names or paste titles in selected-video order.");return}
  setFiles(updated);setError("");setMessage("Applied "+matches+" lecture titles. Review them before preparing.");
 }
 function accessToken(){
  if(!tokenRef.current||Date.now()>=expiryRef.current){
   setConnected(false);
   throw Error("Click Connect Google Drive again. Your Drive token has expired.");
  }
  return tokenRef.current;
 }
 function connect(){
  if(!clientRef.current){setError("Google Drive connection not ready. Check Google OAuth configuration.");return}
  setError("");clientRef.current.requestAccessToken({prompt:"consent"});
 }
 async function preview(){
  setBusy(true);setError("");setMessage("");setFiles([]);setFolder(null);
  try{
   const result=await api("/api/admin/drive/preview",{
    method:"POST",headers:{"X-Drive-Access-Token":accessToken()},
    body:{courseId,folderUrl}
   });
   setFolder(result.folder);
   setFiles(result.files.map(f=>({...f,selected:!f.alreadyImported&&!f.titleExists,title:f.suggestedTitle,chapter:"General"})));
   setMessage(result.files.length+" videos found. Review the titles and select only missing lectures.");
   setConfirmed(false);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function prepare(){
  setBusy(true);setError("");setMessage("");
  try{
   const selected=files.filter(f=>f.selected);
   if(!selected.length)throw Error("Select at least one video");
   if(!confirmed)throw Error("Confirm that the destination and titles are correct");
   const result=await api("/api/admin/drive/imports",{
    method:"POST",headers:{"X-Drive-Access-Token":accessToken()},
    body:{courseId,folderUrl,confirm:true,
     files:selected.map(f=>({fileId:f.id,title:f.title,chapter:f.chapter}))}
   });
   await loadJobs();setMessage(result.message);setFiles([]);setFolder(null);setConfirmed(false);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function start(job){
  if(runningRef.current)return;
  let token;
  try{token=accessToken()}catch(e){setError(e.message);return}
  runningRef.current=true;pauseRef.current=false;setRunning(true);
  setError("");setMessage("");setProgress("");
  try{
   // Each step transfers at most 8 MiB; browser can be paused and resumed.
   for(const item of job.items.filter(i=>i.state!=="completed")){
    let state=item.state,step=0;
    while(state!=="completed"&&!pauseRef.current){
     step++;
     if(step>7500)throw Error("Too many steps for one video. Inspect this job.");
     const result=await api("/api/admin/drive/step",{
      method:"POST",headers:{"X-Drive-Access-Token":token},body:{itemId:item.id}
     });
     state=result.state;
     setProgress(item.title+": "+(state==="completed"?"completed":(result.partsUploaded||result.nextPart-1)+"/"+result.totalParts+" chunks"));
    }
    await loadJobs();
    if(pauseRef.current)break;
   }
   if(pauseRef.current)setMessage("Import paused. Reconnect Drive and Resume when ready.");
   else{setMessage("Import completed. Check your destination folder for the new lectures.");onImported?.()}
  }catch(e){setError(e.message+" — fix the connection and press Resume. Existing lessons are safe.");await loadJobs()}
  finally{runningRef.current=false;setRunning(false)}
 }
 async function reset(item){
  if(!window.confirm("Restart this unfinished video import from the first chunk? This does not delete existing lectures."))return;
  setBusy(true);setError("");
  try{await api("/api/admin/drive/step",{
   method:"POST",body:{itemId:item.id,reset:true},
   headers:{"X-Drive-Access-Token":accessToken()}
  });await loadJobs();setMessage("Unfinished video import reset. Press Resume to restart.")}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!destination)return null;
 return <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-6">
  <div className="flex items-start gap-3">
   <CloudDownload className="mt-1 shrink-0 text-sky-700" size={23}/>
   <div>
    <h3 className="text-lg font-extrabold">Import lectures from Google Drive</h3>
    <p className="mt-1 text-sm leading-6 text-slate-600">Destination: <strong>{destination.title}</strong>. Connect Drive read-only, preview a folder, edit video titles, then prepare and explicitly start the private R2 transfer. Existing lessons and Drive files are never changed.</p>
   </div>
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-3">
   <button type="button" disabled={!oauthReady||busy||running} onClick={connect} className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-bold text-sky-800 disabled:opacity-50">
    <ShieldCheck size={17}/>{connected?"Reconnect Google Drive":"Connect Google Drive"}
   </button>
   <span className="text-xs text-slate-600">{connected?"Connected temporarily · read-only":clientId?"Connect once per import session":"Google Drive OAuth not configured"}</span>
  </div>
  <form onSubmit={e=>{e.preventDefault();preview()}} className="mt-4 flex flex-col gap-2 sm:flex-row">
   <input aria-label="Google Drive folder URL" required value={folderUrl} onChange={e=>setFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={field+" min-w-0 flex-1"}/>
   <button disabled={busy||running||!connected} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
    <FolderInput size={17}/>{busy?"Checking...":"Preview Drive folder"}
   </button>
  </form>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {message&&<p role="status" className="mt-4 rounded-xl bg-white p-3 text-sm text-sky-900">{message}</p>}
  {folder&&<div className="mt-5 rounded-xl border bg-white p-4">
   <h4 className="font-extrabold">{folder.name} · Video selection</h4>
   <p className="mt-1 text-xs text-slate-500">Titles are editable. Previously imported videos and matching titles are unselected automatically.</p>
   <div className="mt-3 max-h-[34rem] space-y-3 overflow-y-auto">
    {files.map((f,i)=><div key={f.id} className="rounded-xl border p-3">
     <div className="flex items-start gap-3"><input aria-label={"Select "+f.name} type="checkbox" checked={f.selected} disabled={Boolean(f.alreadyImported)||running} onChange={e=>setFiles(p=>p.map((x,k)=>k===i?{...x,selected:e.target.checked}:x))} className="mt-1 h-4 w-4"/>
      <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-slate-600">{f.name} · {size(f.size)}</p>
       {f.alreadyImported&&<p className="text-xs text-amber-700">Already prepared/imported ({f.alreadyImported}) — resume old job</p>}
       {f.titleExists&&<p className="text-xs text-amber-700">Similar title exists in the destination — check for duplicates</p>}
       <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr]">
        <input aria-label={"Lesson title for "+f.name} value={f.title} maxLength={220} onChange={e=>setFiles(p=>p.map((x,k)=>k===i?{...x,title:e.target.value}:x))} className={field}/>
        <input aria-label={"Chapter for "+f.name} value={f.chapter} maxLength={160} onChange={e=>setFiles(p=>p.map((x,k)=>k===i?{...x,chapter:e.target.value}:x))} className={field}/>
       </div>
      </div></div>
    </div>)}
   </div>
   <div className="mt-4 rounded-xl bg-sky-50 p-3">
    <label className="block text-xs font-bold text-slate-800">Bulk lecture titles (optional)</label>
    <p className="mt-1 text-xs text-slate-600">Paste one title per line. Titles with #39, #40 etc. automatically match video numbers; otherwise titles map to selected videos in displayed order.</p>
    <textarea rows={4} value={bulkTitles} onChange={e=>setBulkTitles(e.target.value)}
     placeholder="Python Tutorial in Hindi #39 | Reading Files…" className={field+" mt-2"} aria-label="Bulk lecture titles"/>
    <button type="button" onClick={applyBulkTitles} disabled={busy||running} className="mt-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-800">Apply pasted titles</button>
   </div>
   <label className="mt-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/> I checked the destination, titles, order and selected videos. Prepare an import job only; do not upload yet.</label>
   <button type="button" disabled={busy||running||!confirmed||!files.some(f=>f.selected)} onClick={prepare} className="mt-3 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Prepare selected videos ({files.filter(f=>f.selected).length})</button>
  </div>}
  <div className="mt-6">
   <div className="flex items-center justify-between gap-2"><h4 className="font-extrabold">Prepared imports</h4><button type="button" onClick={loadJobs} disabled={busy||running} className="rounded-lg border bg-white p-2" aria-label="Refresh imports"><RefreshCw size={16}/></button></div>
   {!jobs.length&&<p className="mt-2 text-sm text-slate-600">No import jobs in this folder. Nothing has been uploaded.</p>}
   {jobs.map(job=><div key={job.id} className="mt-3 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><p className="text-sm font-extrabold">{job.completed}/{job.total} videos completed</p><p className="mt-1 text-xs text-slate-500">Prepared {new Date(job.createdAt*1000).toLocaleDateString("en-IN")}</p></div>
     {job.completed<job.total&&(running?<button type="button" onClick={()=>{pauseRef.current=true}} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800"><PauseCircle size={17}/> Pause after chunk</button>
     :<button type="button" disabled={!connected||busy} onClick={()=>start(job)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><PlayCircle size={17}/> Start / Resume import</button>)}
    </div>
    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{job.items.map(item=><div key={item.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
     <span className="min-w-[120px] flex-1 break-words">{item.title}</span>
     <span className={item.state==="completed"?"font-bold text-emerald-700":"text-slate-500"}>{item.state}</span>
     {item.error&&<span className="w-full text-amber-800">{item.error}</span>}
     {item.state!=="completed"&&!running&&item.state!=="pending"&&<button type="button" onClick={()=>reset(item)} disabled={busy} className="text-xs font-semibold text-red-700 underline">Reset unfinished</button>}
    </div>)}</div>
   </div>)}
   {progress&&<p role="status" className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">{progress}</p>}
  </div>
  <p className="mt-4 text-xs leading-5 text-slate-500">Transfers are explicitly started by an admin. Keep this tab open during the import; it can be paused and resumed. Google Drive permission is read-only, so source files remain untouched. Only selected destination lessons are added after their R2 videos complete.</p>
 </section>;
}
