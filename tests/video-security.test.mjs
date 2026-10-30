import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertYoutubeSafeForCourse,assertNoYoutubeWhenPaywalled} from "../functions/_lib/video.js";
import {onRequestGet as streamVideo} from "../functions/api/stream/[courseId]/[lectureId].js";
import {onRequestGet as watchVideo} from "../functions/api/watch/[courseId]/[lectureId].js";

function securityDB({parentPrice=0,hasYoutube=false}={}){
 return {prepare(sql){return {bind(...params){return {async first(){
  if(sql.includes("FROM course_inclusions i JOIN courses p"))
   return parentPrice>0?{price:parentPrice}:null;
  if(sql.includes("FROM lectures WHERE youtube_id"))return hasYoutube?{id:"lecture"}:null;
  return null;
 }}}}}};
}

test("free public YouTube lessons remain available",async()=>{
 await assertYoutubeSafeForCourse({DB:securityDB()},"free", "yT123456789",0);
});

test("paid and bundled paid lessons reject shareable YouTube IDs",async()=>{
 await assert.rejects(assertYoutubeSafeForCourse({DB:securityDB()},"paid","yT123456789",2000),/Paid lessons cannot use YouTube/);
 await assert.rejects(assertYoutubeSafeForCourse({DB:securityDB({parentPrice:1200})},"child","yT123456789",0),/Paid lessons cannot use YouTube/);
 await assertYoutubeSafeForCourse({DB:securityDB({parentPrice:1200})},"child","",0);
});

test("cannot switch courses or bundles to paid while public YouTube lessons exist",async()=>{
 await assert.rejects(assertNoYoutubeWhenPaywalled({DB:securityDB({hasYoutube:true})},"master",["child"],1000),/Paid lessons cannot use YouTube/);
 await assert.rejects(assertNoYoutubeWhenPaywalled({DB:securityDB({hasYoutube:true,parentPrice:1000})},"child",[],0),/Paid lessons cannot use YouTube/);
 await assertNoYoutubeWhenPaywalled({DB:securityDB({hasYoutube:true})},"free",[],0);
});

function videoDB({trial=false,enrolled=true}={}){
 const lesson={id:"lecture",r2_object_key:"lessons/course/video.mp4",youtube_id:null,published:1,price_inr:1200,free_preview:0,trial_enabled:trial?1:0,status:"available",details_json:"{}"};
 return {prepare(sql){return {bind(){return {async first(){
  if(sql.includes("FROM sessions s JOIN users u"))return {id:"u",email:"viewer@gmail.com",name:"Viewer",trialExpiresAt:0,staffActive:0};
  if(sql.includes("SELECT l.*"))return lesson;
  if(sql.includes("FROM enrollments e"))return {direct:enrolled?1:0,bundled:0};
  if(sql.includes("FROM course_inclusions i JOIN courses p"))return null;
  return null;
 }}}}}};
}
function context(cookie,options={}){
 const request=new Request("https://infrarivet.pages.dev/api/stream/course/lecture",{
  headers:cookie?{Cookie:"infrarivet_session="+cookie}:{}
 });
 const env={DB:videoDB(options),VIDEOS:{get:async()=>({
  size:4,range:null,body:new Uint8Array([1,2,3,4]),
  writeHttpMetadata(h){h.set("Cache-Control","public, max-age=3600");h.set("Content-Disposition","attachment");h.set("Content-Type","video/mp4")}
 })}};
 return {request,params:{courseId:"course",lectureId:"lecture"},env};
}
test("private video bytes are inaccessible without a signed-in learner session",async()=>{
 const r=await streamVideo(context());
 assert.equal(r.status,401);
 assert.equal(r.headers.get("Cache-Control"),"no-store");
});

test("authorized streams override public object metadata and disable cross-site embedding",async()=>{
 const r=await streamVideo(context("a".repeat(64)));
 assert.equal(r.status,200);
 assert.match(r.headers.get("Cache-Control"),/private, no-store/);
 assert.equal(r.headers.get("Cross-Origin-Resource-Policy"),"same-origin");
 assert.equal(r.headers.get("X-Content-Type-Options"),"nosniff");
 assert.match(r.headers.get("Content-Disposition"),/^inline;/);
 assert.equal(r.headers.get("X-Robots-Tag"),"noindex, noarchive");
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array([1,2,3,4]));
});

test("private video player and Cloudflare pages have copy deterrents and clickjacking controls",()=>{
 const player=readFileSync(new URL("../src/cloudflare/Study.jsx",import.meta.url),"utf8");
 const headers=readFileSync(new URL("../public/_headers",import.meta.url),"utf8");
 assert.match(player,/LearnerWatermark/);
 assert.match(player,/controlsList="nodownload noremoteplayback noplaybackrate"/);
 assert.match(player,/onContextMenu=\{e=>e\.preventDefault\(\)\}/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.match(headers,/frame-ancestors 'none'/);
});

test("Trial-enabled private R2 videos stream to any signed-in student without enrollment or expiry",async()=>{
 const cookie="a".repeat(64);
 const allowed=await streamVideo(context(cookie,{trial:true,enrolled:false}));
 assert.equal(allowed.status,200);
 const refused=await streamVideo(context(cookie,{trial:false,enrolled:false}));
 assert.equal(refused.status,403);
 const anonymous=await streamVideo(context(undefined,{trial:true,enrolled:false}));
 assert.equal(anonymous.status,401);
});
test("Trial-enabled video URL is returned only for signed-in students",async()=>{
 const ctx=context("a".repeat(64),{trial:true,enrolled:false});
 ctx.request=new Request("https://infrarivet.pages.dev/api/watch/course/lecture",{headers:{Cookie:"infrarivet_session="+"a".repeat(64)}});
 const allowed=await watchVideo(ctx);
 assert.equal(allowed.status,200);
 assert.equal((await allowed.json()).provider,"r2");
 const anon=context(undefined,{trial:true,enrolled:false});
 anon.request=new Request("https://infrarivet.pages.dev/api/watch/course/lecture");
 assert.equal((await watchVideo(anon)).status,401);
});
