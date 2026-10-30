import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as listUsers} from "../functions/api/admin/users/index.js";
import {onRequestGet as userDetail,onRequestPut as updateUser} from "../functions/api/admin/users/[id].js";
import {onRequestDelete as revokeSessions} from "../functions/api/admin/users/[id]/sessions.js";

const cookie="a".repeat(64);
const base="https://infrarivet.pages.dev";
function mock({role="owner",active=1,userId="owner-1"}={}){
 const statements=[],runs=[];
 const env={DB:{prepare(sql){
  statements.push(sql);
  return {first:async()=>({total:2,activeTrials:1,activeLearners:1,teamMembers:1,payingLearners:1}),bind(...values){
   return {
    first:async()=>{
     if(sql.includes("FROM sessions s JOIN users u"))return {id:userId,email:"owner@example.com",role,staffActive:active,permissionsJson:"[]"};
     if(sql.includes("COUNT(*) AS n FROM users"))return {n:2};
     if(sql.includes("(SELECT COUNT(*) FROM users) AS total"))return {total:2,activeTrials:1,activeLearners:1,teamMembers:1,payingLearners:1};
     if(sql.includes("SELECT id FROM users WHERE id=?"))return {id:values[0]};
     if(sql.includes("SELECT u.id,st.role FROM users"))return {id:values[0],role:"student"};
     if(sql.includes("SELECT u.id,u.email,u.display_name"))return {id:values[0],email:"student@example.com",displayName:"Student",role:"student"};
     if(sql.includes("AS activeSessions"))return {activeSessions:2,completedLessons:3};
     return {};
    },
    all:async()=>{
     if(sql.includes("FROM users u LEFT JOIN staff st"))return {results:[
      {id:"student-1",email:"student@example.com",displayName:"Student",role:"student",activeCourses:1}
     ]};
     return {results:[]};
    },
    run:async()=>{runs.push({sql,values});return {meta:{changes:1}};}
   };
  }};
 }}};
 return {env,statements,runs};
}
function context(m,path,{method="GET",body,session=true}={}){
 return {env:m.env,params:{id:"student-1"},request:new Request(base+path,{
  method,
  headers:{
   ...(session?{Cookie:"infrarivet_session="+cookie}:{}),
   ...(method!=="GET"?{Origin:base,"Content-Type":"application/json"}:{})
  },
  ...(body?{body:JSON.stringify(body)}:{})
 })};
}
test("Only owner can list student accounts",async()=>{
 const staff=mock({role:"staff"});
 const r=await listUsers(context(staff,"/api/admin/users"));
 assert.equal(r.status,403);
 const anonymous=mock();
 const a=await listUsers(context(anonymous,"/api/admin/users",{session:false}));
 assert.equal(a.status,401);
});
test("Owner sees paginated searchable list with non-sensitive summary",async()=>{
 const m=mock();
 const r=await listUsers(context(m,"/api/admin/users?q=stu&sort=name&page=1&filter=enrolled"));
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.users[0].email,"student@example.com");
 assert.equal(j.total,2);
 assert.equal(j.summary.payingLearners,1);
 assert.equal(m.statements.some(s=>s.includes("instr(lower(u.email),lower(?))")),true);
 assert.equal(JSON.stringify(j).includes("session_token"),false);
});
test("Owner can update display name and trial; arbitrary fields forbidden",async()=>{
 const m=mock();
 const name=await updateUser(context(m,"/api/admin/users/student-1",{method:"PUT",body:{displayName:"  Dev Learner  "}}));
 assert.equal(name.status,200);
 assert.deepEqual(m.runs[0].values,["Dev Learner","student-1"]);
 const trial=await updateUser(context(m,"/api/admin/users/student-1",{method:"PUT",body:{trialExpiresAt:null}}));
 assert.equal(trial.status,200);
 assert.deepEqual(m.runs[1].values,[null,"student-1"]);
 const forbidden=await updateUser(context(m,"/api/admin/users/student-1",{method:"PUT",body:{role:"owner",email:"hijack@example.com"}}));
 assert.equal(forbidden.status,400);
 assert.equal(m.runs.length,2);
});
test("Staff cannot edit any user",async()=>{
 const m=mock({role:"staff"});
 const r=await updateUser(context(m,"/api/admin/users/student-1",{method:"PUT",body:{displayName:"Hacked"}}));
 assert.equal(r.status,403);assert.equal(m.runs.length,0);
});
test("No cross-origin user changes",async()=>{
 const m=mock(),ctx=context(m,"/api/admin/users/student-1",{method:"PUT",body:{displayName:"New"}});
 ctx.request=new Request(base+"/api/admin/users/student-1",{method:"PUT",headers:{Cookie:"infrarivet_session="+cookie,Origin:"https://evil.test","Content-Type":"application/json"},body:JSON.stringify({displayName:"New"})});
 const r=await updateUser(ctx);assert.equal(r.status,403);assert.equal(m.runs.length,0);
});
test("Only owner can revoke other user sessions, never own",async()=>{
 const m=mock();
 const r=await revokeSessions(context(m,"/api/admin/users/student-1/sessions",{method:"DELETE"}));
 assert.equal(r.status,200);assert.equal((await r.json()).count,1);
 assert.match(m.runs[0].sql,/DELETE FROM sessions WHERE user_id/);
 const ctx=context(m,"/api/admin/users/owner-1/sessions",{method:"DELETE"});ctx.params.id="owner-1";
 const refused=await revokeSessions(ctx);assert.equal(refused.status,400);
 assert.equal(m.runs.length,1);
});
test("Sensitive user details remain owner-only",async()=>{
 const m=mock({role:"staff"});
 const r=await userDetail(context(m,"/api/admin/users/student-1"));
 assert.equal(r.status,403);
});
