import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {folderIdFrom,listDriveVideos,downloadRange,PART_SIZE} from "../functions/_lib/drive-import.js";
import {onRequestPost as preview} from "../functions/api/admin/drive/preview.js";
import {onRequestPost as planImport,onRequestGet as importStatus} from "../functions/api/admin/drive/imports.js";
import {onRequestPost as importStep} from "../functions/api/admin/drive/step.js";

const origin="https://infrarivet.pages.dev",cookie="a".repeat(64),token="valid_google_readonly_access_token_123456789";
const folderId="1rULLQgQyxU2UxqIlV4a0xrDSyn-mDtLK";
const fileId="1WnXUV5p2me28_on5rTk2T6jvBum27HjI";
const videoSize=1_000_000;
const restoreFetch=async fn=>{
 const original=globalThis.fetch;
 globalThis.fetch=fn;
 return ()=>{globalThis.fetch=original};
};
function googleMock(url,opts={}){
 const u=new URL(url);
 assert.equal(u.hostname,"www.googleapis.com");
 assert.equal(opts.headers?.Authorization,"Bearer "+token);
 if(u.pathname==="/drive/v3/files/"+folderId)
  return Response.json({id:folderId,name:"DevOps Python Lectures",mimeType:"application/vnd.google-apps.folder",trashed:false});
 if(u.pathname==="/drive/v3/files/"+fileId){
  if(u.searchParams.get("alt")==="media"){
   const range=String(opts.headers?.Range||"");
   const match=range.match(/^bytes=(\d+)-(\d+)$/);
   assert.ok(match);
   const start=Number(match[1]),end=Number(match[2]);
   return new Response(new Uint8Array(end-start+1).fill(7),{
    status:206,headers:{"Content-Range":`bytes ${start}-${end}/${videoSize}`}
   });
  }
  return Response.json({id:fileId,name:"Lecture 39.mp4",size:String(videoSize),parents:[folderId],
   mimeType:"video/mp4",trashed:false});
 }
 if(u.pathname==="/drive/v3/files"&&u.searchParams.has("q"))
  return Response.json({files:[
   {id:fileId,name:"Lecture 39.mp4",size:String(videoSize),mimeType:"video/mp4"},
   {id:"1closed_google_doc_aaaaaaaa",name:"Notes",mimeType:"application/vnd.google-apps.document"}
  ]});
 throw Error("Unexpected Google API request "+u.toString());
}
function mockState({role="owner",active=1,perms=["lectures.manage"],existing=[],already=[]}={}){
 const items=new Map(),jobs=new Map(),lectures=[...existing],changes=[],r2Objects=new Map(),r2Uploads=new Map();
 const db={prepare(sql){
  const statement=(args=[])=>({
   bind(...values){return statement(values)},
   async first(){
    if(sql.includes("FROM sessions s JOIN users u"))return {id:"owner",email:"owner@example.com",role,staffActive:active,permissionsJson:JSON.stringify(perms)};
    if(sql.includes("SELECT id,title FROM courses"))return {id:"docker",title:"Docker"};
    if(sql.includes("SELECT COALESCE(MAX(sort_order)"))return {lastOrder:4};
    if(sql.includes("FROM drive_import_items i")&&sql.includes("WHERE i.id=?")){
     const item=items.get(args[0]);
     return item?{...item,folderId:jobs.get(item.job_id).drive_folder_id}:null;
    }
    return null;
   },
   async all(){
    if(sql.includes("SELECT title FROM lectures"))return {results:lectures.map(l=>({title:l.title}))};
    if(sql.includes("SELECT drive_file_id AS id")||sql.includes("SELECT drive_file_id AS id,state"))
     return {results:[...already,...items.values()].map(x=>({id:x.drive_file_id,state:x.state}))};
    if(sql.includes("COUNT(i.id)"))return {results:[...jobs.values()].map(j=>({
      id:j.id,courseId:j.course_id,driveFolderId:j.drive_folder_id,createdAt:j.created_at,
      total:[...items.values()].filter(i=>i.job_id===j.id).length,
      completed:[...items.values()].filter(i=>i.job_id===j.id&&i.state==="completed").length
     }))};
    if(sql.includes("SELECT i.id,i.job_id AS jobId"))return {results:[...items.values()].map(i=>({
      id:i.id,jobId:i.job_id,title:i.title,sourceName:i.source_name,state:i.state,
      sizeBytes:i.size_bytes,nextPart:i.next_part,error:i.last_error
     }))};
    return {results:[]};
   },
   async run(){
    changes.push({sql,args});
    if(sql.includes("INSERT INTO drive_import_jobs")){
     jobs.set(args[0],{id:args[0],course_id:args[1],created_by:args[2],drive_folder_id:args[3],created_at:100});
    }else if(sql.includes("INSERT INTO drive_import_items")){
     items.set(args[0],{id:args[0],job_id:args[1],course_id:args[2],drive_file_id:args[3],
      source_name:args[4],title:args[5],chapter:args[6],sort_order:args[7],
      mime_type:args[8],size_bytes:args[9],r2_key:args[10],lecture_id:args[11],
      state:"pending",upload_id:null,parts_json:"[]",next_part:1,lease_token:null,lease_expires_at:null,last_error:null});
    }else if(sql.includes("UPDATE drive_import_items")){
     const id=sql.includes("SET lease_token=?")?args[1]:
      sql.includes("SET parts_json=?")?args[3]:
      sql.includes("SET state='uploading'")?args[1]:
      sql.includes("SET state='pending'")?args[0]:
      sql.includes("SET state='finalizing'")?args[0]:
      sql.includes("SET state='completed'")?args[0]:
      sql.includes("SET last_error=?")?args[1]:args[0];
     const item=items.get(id);
     if(!item)return {meta:{changes:0}};
     if(sql.includes("SET lease_token=?")){
      if(item.lease_token)return {meta:{changes:0}};
      item.lease_token=args[0];
     }else if(sql.includes("SET lease_token=NULL"))item.lease_token=null;
     else if(sql.includes("SET state='uploading'")){item.state="uploading";item.upload_id=args[0]}
     else if(sql.includes("SET parts_json=?")){item.parts_json=args[0];item.next_part=args[1];item.state=args[2]}
     else if(sql.includes("SET state='completed'"))item.state="completed";
     else if(sql.includes("SET state='pending'")){item.state="pending";item.upload_id=null;item.parts_json="[]";item.next_part=1}
     else if(sql.includes("SET state='finalizing'"))item.state="finalizing";
     else if(sql.includes("SET last_error=?"))item.last_error=args[0];
    }else if(sql.includes("INSERT OR IGNORE INTO lectures")){
      if(!lectures.some(l=>l.id===args[0]))lectures.push({id:args[0],courseId:args[1],title:args[2],r2Key:args[5]});
    }
    return {meta:{changes:1}};
   }
  });
  return statement();
 },async batch(list){for(const st of list)await st.run();return []}};
 const bucket={
  async createMultipartUpload(key){
   const u={id:"upload-"+r2Uploads.size,key,parts:[]};r2Uploads.set(u.id,u);
   return {uploadId:u.id};
  },
  resumeMultipartUpload(key,id){
   const u=r2Uploads.get(id);
   if(!u||u.key!==key)throw Error("Missing upload");
   return {
    async uploadPart(number,bytes){
     u.parts[number-1]=new Uint8Array(bytes);
     return {partNumber:number,etag:"etag-"+number};
    },
    async complete(parts){
     assert.equal(parts.length,u.parts.length);
     const size=u.parts.reduce((n,p)=>n+p.byteLength,0);
     r2Objects.set(key,{size});return {size};
    },
    async abort(){r2Uploads.delete(id)}
   };
  },
  async head(key){return r2Objects.get(key)||null}
 };
 return {env:{DB:db,VIDEOS:bucket},items,jobs,lectures,changes,r2Objects};
}
function request(data,path,body={},extra={}){
 return {env:data.env,request:new Request(origin+path,{
  method:"POST",headers:{Origin:extra.origin||origin,Cookie:extra.cookie===false?"":"infrarivet_session="+cookie,
   "Content-Type":"application/json","X-Drive-Access-Token":extra.driveToken===false?"":token},
  body:JSON.stringify(body)
 })};
}
test("Drive accepts only trusted folder URLs or folder IDs",()=>{
 assert.equal(folderIdFrom("https://drive.google.com/drive/folders/"+folderId),folderId);
 assert.equal(folderIdFrom(folderId),folderId);
 assert.throws(()=>folderIdFrom("https://evil.example/folders/"+folderId),/Only Google Drive/);
 assert.throws(()=>folderIdFrom("https://drive.google.com.evil.org/drive/folders/"+folderId),/Only Google Drive/);
});
test("Drive preview reads only MP4/WebM metadata and never creates videos",async()=>{
 const undo=await restoreFetch(googleMock);
 try{
  const s=mockState();
  const folder=await listDriveVideos(token,folderId);
  assert.deepEqual(folder.files.map(f=>f.suggestedTitle),["Lecture 39"]);
  const response=await preview(request(s,"/api/admin/drive/preview",{courseId:"docker",folderUrl:folderId}));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.deepEqual(data.files.map(f=>f.name),["Lecture 39.mp4"]);
  assert.equal(s.changes.length,0);
  assert.equal(s.r2Objects.size,0);
 }finally{undo()}
});
test("Only authorized admins can preview private Google Drive folder metadata",async()=>{
 const undo=await restoreFetch(()=>{throw Error("Should not access Drive")});
 try{
  const s=mockState({role:null,active:0});
  assert.equal((await preview(request(s,"/api/admin/drive/preview",{courseId:"docker",folderUrl:folderId}))).status,403);
  assert.equal((await preview(request(mockState(),"/api/admin/drive/preview",{courseId:"docker",folderUrl:folderId},{origin:"https://attacker.example"}))).status,403);
 }finally{undo()}
});
test("Prepare import saves titles and source metadata but does NOT transfer or create lectures",async()=>{
 const undo=await restoreFetch(googleMock);
 try{
  const s=mockState();
  const r=await planImport(request(s,"/api/admin/drive/imports",{
   courseId:"docker",folderUrl:folderId,confirm:true,
   files:[{fileId,title:"Python Tutorial #39 | Files",chapter:"Python"}]
  }));
  assert.equal(r.status,201,JSON.stringify(await r.clone().json()));
  const j=await r.json();
  assert.equal(j.prepared,1);assert.equal(j.uploaded,0);
  assert.equal(s.lectures.length,0);
  assert.equal(s.r2Objects.size,0);
  assert.equal(s.items.size,1);
  assert.equal([...s.items.values()][0].title,"Python Tutorial #39 | Files");
  const r2=await importStatus({env:s.env,request:new Request(origin+"/api/admin/drive/imports?courseId=docker",{headers:{Cookie:"infrarivet_session="+cookie}})});
  assert.equal(r2.status,200);assert.equal((await r2.json()).jobs[0].items[0].state,"pending");
  const duplicate=await planImport(request(s,"/api/admin/drive/imports",{
   courseId:"docker",folderUrl:folderId,confirm:true,files:[{fileId,title:"Different title"}]
  }));
  assert.equal(duplicate.status,409);
 }finally{undo()}
});
test("8MiB chunk upload resumes from pending and creates a paid private lecture only after R2 complete",async()=>{
 const undo=await restoreFetch(googleMock);
 try{
  const s=mockState();
  await planImport(request(s,"/api/admin/drive/imports",{
   courseId:"docker",folderUrl:folderId,confirm:true,
   files:[{fileId,title:"Python 39",chapter:"Files"}]
  }));
  const id=[...s.items.keys()][0],body={itemId:id};
  const first=await importStep(request(s,"/api/admin/drive/step",body));
  assert.equal(first.status,200,JSON.stringify(await first.clone().json()));
  assert.equal((await first.json()).state,"uploading");
  assert.equal(s.lectures.length,0);
  const second=await importStep(request(s,"/api/admin/drive/step",body));
  assert.equal(second.status,200,JSON.stringify(await second.clone().json()));
  assert.equal((await second.json()).state,"finalizing");
  assert.equal(s.lectures.length,0);
  const third=await importStep(request(s,"/api/admin/drive/step",body));
  assert.equal(third.status,200,JSON.stringify(await third.clone().json()));
  assert.equal((await third.json()).state,"completed");
  assert.equal(s.r2Objects.size,1);
  assert.equal(s.lectures.length,1);
  assert.equal(s.lectures[0].title,"Python 39");
  assert.equal(s.lectures[0].r2Key,[...s.items.values()][0].r2_key);
  const again=await importStep(request(s,"/api/admin/drive/step",body));
  assert.equal(again.status,200);
  assert.equal(s.lectures.length,1);
 }finally{undo()}
});
test("A failed Drive chunk never attaches a lecture or exposes videos",async()=>{
 const undo=await restoreFetch((url,opts)=>{
  const u=new URL(url);
  if(u.searchParams.get("alt")==="media")return new Response("Drive temporarily busy",{status:503});
  return googleMock(url,opts);
 });
 try{
  const s=mockState();
  await planImport(request(s,"/api/admin/drive/imports",{
   courseId:"docker",folderUrl:folderId,confirm:true,files:[{fileId,title:"Python 39"}]
  }));
  const id=[...s.items.keys()][0];
  await importStep(request(s,"/api/admin/drive/step",{itemId:id}));
  const failed=await importStep(request(s,"/api/admin/drive/step",{itemId:id}));
  assert.equal(failed.status,503);
  assert.equal(s.lectures.length,0);
  assert.equal(s.r2Objects.size,0);
 }finally{undo()}
});
test("Importer UI requires explicit Start or Resume and does not auto-upload",()=>{
 const ui=readFileSync(new URL("../src/cloudflare/DriveImporter.jsx",import.meta.url),"utf8");
 assert.match(ui,/Prepare selected videos/);
 assert.match(ui,/Start \/ Resume import/);
 assert.match(ui,/function DriveImporter/);
 assert.match(ui,/requestAccessToken/);
});
