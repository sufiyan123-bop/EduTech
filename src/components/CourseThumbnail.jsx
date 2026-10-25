import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
export function normalizeThumbnail(input){
 const raw=(input||"").trim();if(!raw)return "";
 try{const u=new URL(raw);if(!["https:","http:"].includes(u.protocol))return "";
  if(u.hostname==="drive.google.com"){const id=u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||u.searchParams.get("id");if(id)return "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1280"}
  if(u.hostname==="www.dropbox.com"||u.hostname==="dropbox.com"){u.searchParams.delete("dl");u.searchParams.set("raw","1");return u.toString()}
  return u.toString()
 }catch{return ""}
}
export default function CourseThumbnail({src,alt="",className=""}){
 const url=normalizeThumbnail(src),[failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[url]);
 return url&&!failed?<img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className={"h-full w-full object-cover "+className}/>:<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-blue-900 to-sky-700"><BookOpen size={46} className="text-white/75"/></div>;
}
