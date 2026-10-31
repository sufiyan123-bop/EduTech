import {useState} from "react";
import {api} from "./api.js";
import {Folder,FolderOpen,FolderPlus,PenLine,Trash2,ArrowLeft,BookOpen} from "lucide-react";

export default function CourseFolderManager({
 courses,selectedCourse,loadLectures,refresh,mayManage,setError,setMessage
}){
 const [name,setName]=useState(""),[working,setWorking]=useState(false);
 const selected=courses.find(c=>c.id===selectedCourse);
 const parent=courses.find(c=>(c.includedCourseIds||[]).includes(selectedCourse));
 const master=parent||selected;
 const children=(master?.includedCourseIds||[]).map(id=>courses.find(c=>c.id===id)).filter(Boolean);
 const activeFolder=Boolean(parent);
 async function createFolder(e){
  e.preventDefault();
  const clean=name.trim();
  if(!master||!clean||working)return;
  setWorking(true);setError("");setMessage("");
  try{
   const res=await api("/api/admin/folders",{method:"POST",body:{parentCourseId:master.id,name:clean}});
   await refresh();
   setName("");loadLectures(res.id);
   setMessage("Folder created. Add video lessons inside "+clean+".");
  }catch(error){setError(error.message)}
  finally{setWorking(false)}
 }
 async function renameFolder(folder){
  const name=window.prompt("New name for the folder:",folder.title);
  if(name===null||!name.trim()||name.trim()===folder.title)return;
  setWorking(true);setError("");setMessage("");
  try{
   await api("/api/admin/folders",{method:"PATCH",body:{parentCourseId:master.id,folderId:folder.id,name:name.trim()}});
   await refresh();setMessage("Folder renamed successfully.");
  }catch(error){setError(error.message)}finally{setWorking(false)}
 }
 async function removeFolder(folder){
  if(!window.confirm("Remove empty folder "+folder.title+"? Folders with lessons or student records cannot be removed."))return;
  setWorking(true);setError("");setMessage("");
  try{
   await api("/api/admin/folders",{method:"DELETE",body:{parentCourseId:master.id,folderId:folder.id}});
   if(selectedCourse===folder.id)loadLectures(master.id);
   await refresh();setMessage("Empty folder removed.");
  }catch(error){setError(error.message)}finally{setWorking(false)}
 }
 if(!master)return null;
 return <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">Course folders</p>
    <h3 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-slate-900"><FolderOpen size={19}/>{master.title}</h3>
    <p className="mt-1 text-xs leading-5 text-slate-600">Create Linux, Python, Docker or other folders. Open a folder to upload its private R2 video lessons.</p>
   </div>
   {activeFolder&&<button type="button" onClick={()=>loadLectures(master.id)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-800"><ArrowLeft size={15}/> Back to {master.title}</button>}
  </div>
  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
   {children.map(folder=><div key={folder.id} className={"rounded-xl border p-3 "+(selectedCourse===folder.id?"border-indigo-500 bg-indigo-100":"border-slate-200 bg-white")}>
    <button type="button" className="flex w-full items-center gap-2 text-left" onClick={()=>loadLectures(folder.id)}>
     <Folder size={19} className="shrink-0 text-indigo-700"/>
     <span className="min-w-0 flex-1 break-words text-sm font-bold">{folder.title}</span>
     <span className="text-xs font-semibold text-indigo-700">Open</span>
    </button>
    <p className="mt-1 text-xs text-slate-500">{folder.folderOnly?"Private folder":"Included course"}</p>
    {folder.folderOnly&&mayManage&&<div className="mt-3 flex gap-2">
     <button type="button" onClick={()=>renameFolder(folder)} disabled={working} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-50"><PenLine size={13}/> Rename</button>
     <button type="button" onClick={()=>removeFolder(folder)} disabled={working} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 size={13}/> Remove empty</button>
    </div>}
   </div>)}
  </div>
  {!children.length&&<p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><BookOpen size={16}/> No folders yet. Create your first one below.</p>}
  {mayManage&&<form onSubmit={createFolder} className="mt-4 flex flex-wrap gap-2">
    <input aria-label="New course folder name" maxLength={120} placeholder="New folder: Linux, Python, Docker…" value={name}
     onChange={e=>setName(e.target.value)} className="min-w-[180px] flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm outline-indigo-600"/>
    <button disabled={working||!name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
     <FolderPlus size={17}/>{working?"Saving…":"Create folder"}
    </button>
   </form>}
  <p className="mt-3 text-xs text-slate-600">Existing standalone courses can also be included from Courses → Edit master → Included courses. Their videos and students remain in their original courses.</p>
 </div>;
}
