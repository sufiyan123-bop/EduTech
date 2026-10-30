import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as listStaff,onRequestPost as saveStaff,onRequestDelete as removeStaff} from "../functions/api/admin/staff.js";
import {protectOwnerAccount} from "../functions/_lib/core.js";

const base="https://infrarivet.pages.dev";
const cookie="a".repeat(64);
function mock({actorRole="owner",actorActive=1,existing=true,targetRole=null,
 targetEmail="student@example.com",targetProvider="email_otp"}={}){
 const operations=[],user={id:"student-1",email:targetEmail,auth_provider:targetProvider,role:targetRole};
 let target=existing?user:null;
 const env={OWNER_EMAIL:"owner@example.com",DB:{
  prepare(sql){
   return {
    all:async()=>({results:[{userId:"owner-1",email:"owner@example.com",role:"owner",permissions:'["*"]',active:1}]}),
    bind(...values){
     return {
      first:async()=>{
       if(sql.includes("FROM sessions s JOIN users u"))return {id:"owner-1",email:"owner@example.com",role:actorRole,staffActive:actorActive,permissionsJson:"[]"};
       if(sql.includes("FROM users u LEFT JOIN staff s")&&sql.includes("u.email=?"))return target;
       if(sql.includes("FROM staff s JOIN users u"))return target?{id:target.id,email:target.email,role:targetRole,active:1}:null;
       if(sql.includes("SELECT u.email,s.role FROM users u"))return target?{email:target.email,role:target.role}:null;
       return null;
      },
      run:async()=>{
       operations.push({sql,values});
       if(sql.includes("INSERT INTO users")){
        target={id:values[0],email:values[1],auth_provider:"pending_otp",role:null};
       }
       return {meta:{changes:1}};
      }
     };
    }
   };
  }
 }};
 return {env,operations};
}
function context(m,{method="GET",body,origin=base,cookieEnabled=true}={}){
 const headers={...(cookieEnabled?{Cookie:"infrarivet_session="+cookie}:{}),
  ...(method!=="GET"?{Origin:origin,"Content-Type":"application/json"}:{})};
 return {env:m.env,request:new Request(base+"/api/admin/staff",{
  method,headers,...(body?{body:JSON.stringify(body)}:{})
 })};
}
test("Owner can list staff; a delegated admin cannot view the team",async()=>{
 const o=mock();
 const r=await listStaff(context(o));
 assert.equal(r.status,200);
 assert.equal((await r.json()).staff[0].role,"owner");
 const s=mock({actorRole:"staff"});
 assert.equal((await listStaff(context(s))).status,403);
});
test("Owner can grant specific non-owner permissions to an existing verified user",async()=>{
 const m=mock();
 const r=await saveStaff(context(m,{method:"POST",body:{email:"student@example.com",
  permissions:["courses.view","lectures.manage"]}}));
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.pendingSignIn,false);
 const statement=m.operations.find(s=>s.sql.includes("INSERT INTO staff"));
 assert.ok(statement);
 assert.match(statement.sql,/WHERE staff.role<>'owner'/);
 assert.deepEqual(JSON.parse(statement.values[1]),["courses.view","lectures.manage"]);
 assert.doesNotMatch(statement.sql,/role='owner'/);
});
test("Owner can grant pending admin by email, but sign-in still requires verification",async()=>{
 const m=mock({existing:false});
 const r=await saveStaff(context(m,{method:"POST",body:{
  email:"new@example.com",permissions:["courses.view"]}}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).pendingSignIn,true);
 assert.ok(m.operations.some(x=>x.sql.includes("INSERT INTO users")&&x.sql.includes("pending_otp")));
 assert.ok(m.operations.some(x=>x.sql.includes("INSERT INTO staff")));
 // No sessions are created by admin assignment.
 assert.equal(m.operations.some(x=>x.sql.includes("INSERT INTO sessions")),false);
});
test("Staff cannot grant or remove admins even with client-supplied permissions",async()=>{
 const m=mock({actorRole:"staff"});
 assert.equal((await saveStaff(context(m,{method:"POST",body:{
  email:"student@example.com",permissions:["courses.view"]}}))).status,403);
 assert.equal((await removeStaff(context(m,{method:"DELETE",body:{userId:"student-1"}}))).status,403);
 assert.equal(m.operations.length,0);
});
test("Owner cannot be altered, impersonated, removed or self-removed",async()=>{
 const targetOwner=mock({targetRole:"owner",targetEmail:"other-owner@example.com"});
 assert.equal((await saveStaff(context(targetOwner,{method:"POST",body:{
  email:"other-owner@example.com",permissions:["courses.manage"]}}))).status,403);
 assert.equal((await removeStaff(context(targetOwner,{method:"DELETE",body:{userId:"student-1"}}))).status,403);
 const designated=mock({targetEmail:"owner@example.com"});
 assert.equal((await saveStaff(context(designated,{method:"POST",body:{
  email:"owner@example.com",permissions:["courses.view"]}}))).status,403);
 assert.equal((await removeStaff(context(designated,{method:"DELETE",body:{userId:"student-1"}}))).status,403);
 const self=mock();
 assert.equal((await removeStaff(context(self,{method:"DELETE",body:{userId:"owner-1"}}))).status,404);
 for(const m of [targetOwner,designated,self])assert.equal(m.operations.length,0);
});
test("Invalid permissions, fake role, and foreign-origin writes cannot escalate roles",async()=>{
 const m=mock();
 for(const body of [
  {email:"student@example.com",permissions:["*"]},
  {email:"student@example.com",permissions:["staff.manage"]},
  {email:"student@example.com",permissions:[]},
  {email:"student@example.com",permissions:["courses.view"],role:"owner"}
 ]){
  assert.equal((await saveStaff(context(m,{method:"POST",body}))).status,400);
 }
 const r=await saveStaff(context(m,{method:"POST",origin:"https://evil.example",body:{
  email:"student@example.com",permissions:["courses.view"]
 }}));
 assert.equal(r.status,403);
 assert.equal(m.operations.length,0);
});
test("Owner can revoke admin access without deleting their student account",async()=>{
 const m=mock();
 const r=await removeStaff(context(m,{method:"DELETE",body:{userId:"student-1"}}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).removed,true);
 assert.equal(m.operations.length,1);
 assert.match(m.operations[0].sql,/DELETE FROM staff WHERE user_id=\? AND role='staff'/);
 assert.equal(m.operations.some(x=>x.sql.includes("DELETE FROM users")),false);
 assert.equal(m.operations.some(x=>x.sql.includes("DELETE FROM sessions")),false);
});
test("Delegated staff cannot change owner enrollments or trial",async()=>{
 const m=mock({targetRole:"owner",targetEmail:"owner@example.com"});
 const actor={id:"staff-1",role:"staff",staffActive:1};
 await assert.rejects(protectOwnerAccount(m.env,actor,{email:"owner@example.com"}),/Only the owner/);
 await assert.rejects(protectOwnerAccount(m.env,actor,{userId:"student-1"}),/Only the owner/);
 await assert.doesNotReject(protectOwnerAccount(m.env,{role:"owner",staffActive:1},{email:"owner@example.com"}));
});
