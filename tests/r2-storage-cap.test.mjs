import test from "node:test";
import assert from "node:assert/strict";
import {getR2StorageUsage,requireR2Capacity,R2_UPLOAD_TARGET_BYTES,R2_ABSOLUTE_MAX_BYTES} from "../functions/_lib/r2-quota.js";
import {onRequestGet as getStorage} from "../functions/api/admin/storage.js";
import {onRequestPut as uploadVideo} from "../functions/api/admin/upload.js";
import {onRequestPut as uploadThumbnail} from "../functions/api/admin/thumbnail-upload.js";

const origin="https://infrarivet.pages.dev",cookie="a".repeat(64);
const originalR2=2_937_548_562;
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
function storageBucket(used=originalR2){
 const writes=[];
 return {writes,
  list:async()=>({objects:used?[{size:used}]:[],truncated:false}),
  put:async(...args)=>{writes.push(args)}
 };
}
function context(bucket,method,path,{body=new Uint8Array([1,2,3,4]),type="video/mp4",signedIn=true}={}){
 return {env:{VIDEOS:bucket,DB:{prepare(sql){
  return {bind(...args){return {async first(){
   if(sql.includes("FROM sessions s JOIN users u"))return {id:"owner",role:"owner",staffActive:1,permissionsJson:"[]"};
   if(sql.includes("SELECT id FROM courses"))return {id:"docker"};
   return null;
  }}};
 }};}},request:new Request(origin+path,{method,headers:{
  Origin:origin,"Content-Type":type,"Content-Length":String(body.byteLength),"X-Course-Id":"docker",
  ...(signedIn?{Cookie:"infrarivet_session="+cookie}:{})
 },...(method!=="GET"?{body}: {})})};
}
test("Quota is decimal 9GB with a strict 300MB buffer below 9.3GB",()=>{
 assert.equal(R2_UPLOAD_TARGET_BYTES,9_000_000_000);
 assert.equal(R2_ABSOLUTE_MAX_BYTES,9_300_000_000);
});
test("The current 2.94GB bucket leaves approximately 6.06GB for new videos",async()=>{
 const bucket=storageBucket();
 const usage=await getR2StorageUsage(bucket);
 assert.equal(usage.usedBytes,originalR2);
 assert.equal(usage.remainingBytes,9_000_000_000-originalR2);
 await requireR2Capacity(bucket,usage.remainingBytes);
 await assert.rejects(requireR2Capacity(bucket,usage.remainingBytes+1),e=>e.status===413);
});
test("R2 usage includes all listing pages, not only the first 1000 objects",async()=>{
 let calls=0;
 const bucket={async list(options){
  calls++;
  return options.cursor==="next"?{objects:[{size:1_100}],truncated:false}:
   {objects:[{size:700},{size:900}],truncated:true,cursor:"next"};
 }};
 const usage=await getR2StorageUsage(bucket);
 assert.equal(calls,2);
 assert.equal(usage.usedBytes,2700);
 assert.equal(usage.objects,3);
});
test("Unverified, invalid and looping R2 listings always fail closed",async()=>{
 for(const b of [
  {},{list:async()=>({objects:[{size:-1}],truncated:false})},
  {list:async()=>({objects:[],truncated:true})},
  {list:async()=>({objects:[],truncated:true,cursor:"same"})}
 ])await assert.rejects(requireR2Capacity(b,500),e=>e.status===503);
});
test("Authorized admin can see storage usage without revealing bucket data publicly",async()=>{
 const bucket=storageBucket();
 const loggedIn=context(bucket,"GET","/api/admin/storage");
 const res=await getStorage(loggedIn);
 assert.equal(res.status,200);
 assert.equal((await res.json()).storage.usedBytes,originalR2);
 const anonymous=context(bucket,"GET","/api/admin/storage",{signedIn:false});
 assert.equal((await getStorage(anonymous)).status,401);
});
test("Manual MP4 upload under quota is allowed, but an upload crossing 9GB is rejected before R2.put",async()=>{
 const ok=storageBucket(originalR2),failed=storageBucket(8_999_999_999);
 const opts={body:new Uint8Array(16)};
 const success=await uploadVideo(context(ok,"PUT","/api/admin/upload",opts));
 assert.equal(success.status,200);
 assert.equal(ok.writes.length,1);
 const rejected=await uploadVideo(context(failed,"PUT","/api/admin/upload",opts));
 assert.equal(rejected.status,413);
 assert.equal(failed.writes.length,0);
});
test("Even course thumbnails cannot silently push R2 over the budget",async()=>{
 const bucket=storageBucket(9_000_000_000);
 const response=await uploadThumbnail(context(bucket,"PUT","/api/admin/thumbnail-upload",{body:png,type:"image/png"}));
 assert.equal(response.status,413);
 assert.equal(bucket.writes.length,0);
});
