import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPost as checkout} from "../functions/api/payments/create-order.js";
import {onRequestPut as saveMaster} from "../functions/api/admin/courses/[id].js";
import {isEnrolled} from "../functions/_lib/core.js";

const origin="https://infrarivet.pages.dev";
const live={
 PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"live",LIVE_PAYMENTS_APPROVED:"true",
 RAZORPAY_KEY_ID:"rzp_live_example123",RAZORPAY_KEY_SECRET:"fake-only",
 RAZORPAY_WEBHOOK_SECRET:"fake-webhook"
};
const courses={
 python:{id:"python",title:"Python with Linux",published:1,status:"available",
  details_json:JSON.stringify({plans:{"1":149,"3":299}})},
 linux:{id:"linux",title:"Linux Deep dive",published:1,status:"available",
  details_json:JSON.stringify({plans:{"1":149}})},
 devops:{id:"devops",title:"DevOps",published:1,status:"available",
  details_json:JSON.stringify({plans:{"1":999,"3":2999}})},
 folder:{id:"folder",title:"Private folder",published:0,status:"available",
  details_json:'{"folderOnly":true}'}
};
function createCtx(courseId,{hasBundle=false,existingSource=null,login=true}={}){
 const orders=[],sqls=[];
 const env={...live,DB:{prepare(sql){
  sqls.push(sql);
  return {bind(...values){return {
   async first(){
    if(sql.includes("FROM sessions s JOIN users u"))return {id:"buyer",email:"student@example.com"};
    if(sql.includes("FROM courses WHERE id=?"))return courses[values[0]]||null;
    if(sql.includes("SELECT p.title AS parentTitle"))return hasBundle?{parentTitle:"DevOps"}:null;
    if(sql.includes("SELECT source FROM enrollments"))return existingSource?{source:existingSource}:null;
    return null;
   },
   async run(){orders.push({sql,values});return {meta:{changes:1}}}
  }}}
 }}};
 const request=new Request(origin+"/api/payments/create-order",{
  method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...(login?{Cookie:"infrarivet_session="+"a".repeat(64)}:{})},
  body:JSON.stringify({courseId,months:1})
 });
 return {ctx:{env,request},orders,sqls};
}
test("A student can purchase Python alone at its ₹149 price even when Python is included in DevOps",async()=>{
 const oldFetch=globalThis.fetch;
 let callCount=0;
 globalThis.fetch=async(_url,opts)=>{
  callCount++;
  const data=JSON.parse(opts.body);
  assert.equal(data.amount,14900);
  assert.equal(data.notes.courseId,"python");
  return Response.json({id:"order_standalone",amount:data.amount,currency:"INR"});
 };
 try{
  const s=createCtx("python");
  const r=await checkout(s.ctx);
  assert.equal(r.status,200);
  assert.equal((await r.json()).amount,14900);
  assert.equal(s.orders.length,1);
  assert.equal(s.orders[0].values[2],"python");
  assert.equal(callCount,1);
 }finally{globalThis.fetch=oldFetch}
});
test("DevOps checkout charges the DevOps plan, not the sum of child course prices",async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async(_url,opts)=>{
  const data=JSON.parse(opts.body);
  assert.equal(data.amount,99900);
  assert.equal(data.notes.courseId,"devops");
  return Response.json({id:"order_master",amount:data.amount,currency:"INR"});
 };
 try{
  const s=createCtx("devops");
  const r=await checkout(s.ctx);
  assert.equal(r.status,200);
  assert.equal((await r.json()).amount,99900);
  assert.equal(s.orders[0].values[2],"devops");
 }finally{globalThis.fetch=oldFetch}
});
test("An active DevOps member cannot accidentally pay again for an included Python course",async()=>{
 const s=createCtx("python",{hasBundle:true});
 const r=await checkout(s.ctx);
 assert.equal(r.status,409);
 assert.match((await r.json()).error,/already have access through DevOps/);
 assert.equal(s.orders.length,0);
});
test("Private folder cannot be purchased standalone even with forged published state",async()=>{
 const s=createCtx("folder");
 assert.equal((await checkout(s.ctx)).status,404);
});
test("Students must sign in for either individual or bundle checkout",async()=>{
 const s=createCtx("devops",{login:false});
 assert.equal((await checkout(s.ctx)).status,401);
});

function masterCtx(included,{shared=[{childId:"python",privateFolder:0}],admin=true}={}){
 const runs=[],queries=[];
 const DB={prepare(sql){
  queries.push(sql);
  return {
   async all(){return sql.includes("SELECT id FROM courses")?{results:[{id:"devops"},{id:"python"},{id:"linux"},{id:"folder"}]}:{results:[]};},
   bind(...values){return {
    async first(){
     if(sql.includes("FROM sessions s JOIN users u"))
      return {id:"admin",role:admin?"owner":null,staffActive:admin?1:0,permissionsJson:"[]"};
     if(sql.includes("SELECT id,details_json FROM courses"))return {id:"devops",details_json:"{}"};
     if(sql.includes("SELECT p.price_inr AS price"))return null;
     if(sql.startsWith("SELECT id FROM lectures"))return null;
     return null;
    },
    async all(){
     if(sql.includes("SELECT id FROM courses"))return {results:[{id:"devops"},{id:"python"},{id:"linux"},{id:"folder"}]};
     if(sql.includes("AS privateFolder"))return {results:shared};
     if(sql.includes("SELECT parent_course_id FROM course_inclusions"))return {results:[]};
     return {results:[]};
    },
    async run(){runs.push({sql,values});return {meta:{changes:1}}}
   };
  }
  };
 }};
 DB.batch=async stmts=>{for(const st of stmts)await st.run();return []};
 const request=new Request(origin+"/api/admin/courses/devops",{
  method:"PUT",headers:{Cookie:"infrarivet_session="+"a".repeat(64),Origin:origin,"Content-Type":"application/json"},
  body:JSON.stringify({title:"DevOps",price:999,published:true,track:"DevOps",includedCourseIds:included})
 });
 return {ctx:{env:{DB},params:{id:"devops"},request},runs,queries};
}
test("Published standalone Python and Linux can be linked to DevOps without modifying their videos or separate prices",async()=>{
 const s=masterCtx(["python","linux"],{shared:[{childId:"python",privateFolder:0}]});
 const r=await saveMaster(s.ctx);
 assert.equal(r.status,200);
 assert.deepEqual(s.runs.filter(x=>x.sql.includes("INSERT INTO course_inclusions")).map(x=>x.values.slice(0,2)),[
  ["devops","python"],["devops","linux"]
 ]);
 assert.equal(s.runs.some(x=>x.sql.includes("UPDATE lectures")||x.sql.includes("DELETE FROM lectures")),false);
 assert.equal(s.runs.some(x=>x.sql.includes("UPDATE courses")&&!x.sql.includes("WHERE id=?")),false);
});
test("Private folders cannot be shared across master courses",async()=>{
 const s=masterCtx(["folder"],{shared:[{childId:"folder",privateFolder:1}]});
 assert.equal((await saveMaster(s.ctx)).status,409);
 assert.equal(s.runs.length,0);
});
test("Non-admin accounts cannot attach any course to DevOps",async()=>{
 const s=masterCtx(["python"],{admin:false});
 assert.equal((await saveMaster(s.ctx)).status,403);
 assert.equal(s.runs.length,0);
});
test("Parent enrollment unlocks its included course; Python-only enrollment does not grant DevOps",async()=>{
 const make=(direct,bundled)=>({DB:{prepare:sql=>({bind:()=>({first:async()=>({direct,bundled})})})}});
 assert.equal(await isEnrolled(make(0,1),"buyer","python"),true);
 assert.equal(await isEnrolled(make(1,0),"buyer","python"),true);
 assert.equal(await isEnrolled(make(0,0),"buyer","devops"),false);
});
