import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPut,validImageBytes} from "../functions/api/admin/thumbnail-upload.js";
import {onRequestGet} from "../functions/api/thumbnails/[id].js";

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const session="a".repeat(64);
function mockEnv(){
 const files=new Map();
 return {
  DB:{prepare(){return {bind(){return {first:async()=>({
   id:"owner-1",email:"admin@example.com",role:"owner",staffActive:1,permissionsJson:"[]"
  })}}}}},
  VIDEOS:{
   put:async (key,bytes,options)=>{files.set(key,{body:bytes,httpMetadata:options.httpMetadata});},
   get:async key=>files.get(key)||null
  }
 };
}
function requestUpload(data,type="image/png",authenticated=true){
 return new Request("https://infrarivet.pages.dev/api/admin/thumbnail-upload",{
  method:"PUT",headers:{
   Origin:"https://infrarivet.pages.dev",
   "Content-Type":type,
   ...(authenticated?{Cookie:"infrarivet_session="+session}: {})
  },body:data
 });
}
test("Owner can upload thumbnail to private R2 and serve it over public image route",async()=>{
 const env=mockEnv();
 const result=await onRequestPut({request:requestUpload(png),env});
 assert.equal(result.status,200);
 const {url}=await result.json();
 assert.match(url,/^https:\/\/infrarivet\.pages\.dev\/api\/thumbnails\/[a-f0-9-]{36}$/);
 const id=url.split("/").pop();
 const show=await onRequestGet({params:{id},env});
 assert.equal(show.status,200);
 assert.equal(show.headers.get("Content-Type"),"image/png");
 assert.equal(show.headers.get("X-Content-Type-Options"),"nosniff");
 assert.deepEqual(new Uint8Array(await show.arrayBuffer()),png);
});
test("File signature validation rejects disguised uploads",async()=>{
 assert.equal(validImageBytes(png,"image/png"),true);
 assert.equal(validImageBytes(new Uint8Array([60,104,116,109,108,62]),"image/png"),false);
 const result=await onRequestPut({request:requestUpload(new TextEncoder().encode("<html>"),"image/png"),env:mockEnv()});
 assert.equal(result.status,415);
});
test("Only authenticated course managers can upload",async()=>{
 const result=await onRequestPut({request:requestUpload(png,"image/png",false),env:mockEnv()});
 assert.equal(result.status,401);
});
test("Public thumbnail route rejects invalid IDs",async()=>{
 const result=await onRequestGet({params:{id:"../../admin"},env:mockEnv()});
 assert.equal(result.status,404);
});
test("Oversized upload rejected",async()=>{
 const result=await onRequestPut({request:requestUpload(new Uint8Array(3*1024*1024+1)),env:mockEnv()});
 assert.equal(result.status,413);
});
