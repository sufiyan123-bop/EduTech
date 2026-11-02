import {fail} from "./core.js";

export const PART_SIZE=8*1024*1024;
export const MAX_ITEMS=100;
export const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.readonly";

export function folderIdFrom(input){
 const raw=String(input||"").trim();
 if(/^[\w-]{10,150}$/.test(raw))return raw;
 let url;
 try{url=new URL(raw)}catch{fail(400,"Paste a valid Google Drive folder link")}
 if(url.protocol!=="https:"||url.hostname!=="drive.google.com")
  fail(400,"Only Google Drive folder links are accepted");
 const id=url.pathname.match(/\/folders\/([\w-]{10,150})(?:\/|$)/)?.[1]||url.searchParams.get("id");
 if(!id||! /^[\w-]{10,150}$/.test(id))fail(400,"Invalid Google Drive folder link");
 return id;
}
export function driveToken(request){
 const token=String(request.headers.get("X-Drive-Access-Token")||"");
 if(token.length<20||token.length>4096||/\s/.test(token))
  fail(401,"Connect your Google Drive account to continue");
 return token;
}
function driveUrl(path,params){
 const url=new URL("https://www.googleapis.com/drive/v3/"+path);
 for(const [key,value] of Object.entries(params||{}))url.searchParams.set(key,String(value));
 return url.toString();
}
export async function driveRequest(token,path,params={},headers={}){
 const response=await fetch(driveUrl(path,params),{
  method:"GET",headers:{Authorization:"Bearer "+token,...headers},redirect:"error",signal:AbortSignal.timeout(90000)
 });
 if(!response.ok){
  if(response.status===401)fail(401,"Google Drive connection expired. Reconnect and resume.");
  if(response.status===403)fail(403,"Google Drive denied access. Reconnect with Drive read-only permission.");
  if(response.status===404)fail(404,"Google Drive folder or video not found.");
  if(response.status===429||response.status>=500)fail(503,"Google Drive is busy. Retry this step.");
  fail(502,"Google Drive request failed ("+response.status+")");
 }
 return response;
}
export async function driveFile(token,id){
 if(!/^[\w-]{10,150}$/.test(id))fail(400,"Invalid Drive file ID");
 const r=await driveRequest(token,"files/"+encodeURIComponent(id),{
  fields:"id,name,mimeType,size,parents,trashed",supportsAllDrives:"true"
 });
 return r.json();
}
export async function listDriveVideos(token,folderId){
 const folder=await driveFile(token,folderId);
 if(folder.mimeType!=="application/vnd.google-apps.folder"||folder.trashed)
  fail(400,"The shared link is not a Google Drive folder");
 let pageToken="",files=[];
 do{
  const q="'"+folderId.replace(/'/g,"\\'")+"' in parents and trashed = false";
  const r=await driveRequest(token,"files",{
   q,fields:"nextPageToken,files(id,name,mimeType,size,parents,trashed)",
   pageSize:1000,supportsAllDrives:"true",includeItemsFromAllDrives:"true",
   ...(pageToken?{pageToken}:{})
  });
  const list=await r.json();
  files.push(...(list.files||[]));
  if(files.length>1500)fail(413,"Drive folder contains too many items. Use a smaller folder.");
  pageToken=list.nextPageToken||"";
 }while(pageToken);
 const videos=files.filter(f=>["video/mp4","video/webm"].includes(f.mimeType)&&
  Number.isSafeInteger(Number(f.size))&&Number(f.size)>0&&Number(f.size)<=50*1024*1024*1024);
 videos.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
 return {folder:{id:folder.id,name:folder.name},files:videos.map(f=>({
  id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size),
  suggestedTitle:f.name.replace(/\.(mp4|webm)$/i,"").trim()
 }))};
}
export function cleanImportTitle(raw){
 const title=String(raw||"").trim();
 if(!title||title.length>220)fail(400,"Lecture title must be 1–220 characters");
 return title;
}
export function cleanChapter(raw){
 const chapter=String(raw||"General").trim()||"General";
 if(chapter.length>160)fail(400,"Chapter name is too long");
 return chapter;
}
export async function downloadRange(token,fileId,start,end,expectedSize){
 const r=await driveRequest(token,"files/"+encodeURIComponent(fileId),{alt:"media"},{
  Range:"bytes="+start+"-"+end
 });
 if(r.status!==206&&!(start===0&&end===expectedSize-1&&r.status===200))
  fail(502,"Google Drive did not return the requested video range");
 const range=r.headers.get("content-range");
 if(r.status===206&&range){
  const match=range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  if(!match||Number(match[1])!==start||Number(match[2])!==end||Number(match[3])!==expectedSize)
   fail(409,"The Drive video changed since this import was prepared");
 }
 const data=await r.arrayBuffer();
 if(data.byteLength!==end-start+1)fail(502,"Incomplete Drive video chunk. Retry.");
 return data;
}
