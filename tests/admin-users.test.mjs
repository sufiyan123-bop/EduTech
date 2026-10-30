import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as listUsers} from "../functions/api/admin/users/index.js";
import {onRequestGet as userDetail,onRequestPut as updateUser,onRequestDelete as deleteUser} from "../functions/api/admin/users/[id].js";
import {onRequestDelete as revokeSessions} from "../functions/api/admin/users/[id]/sessions.js";

const cookie="a".repeat(64);
const base="https://infrarivet.pages.dev";
function mock({role="owner",active=1,userId="owner-1",targetRole="student",targetActive=0,paymentOrders=0,exists=true,permissions=[]}={}){
 const statements=[],runs=[],batches=[];
 const env={DB:{
  async batch(operations){batches.push(operations);for(const operation of operations)await operation.run();return [];},
  prepare(sql){
  statements.push(sql);
  return {first:async()=>({total:2,activeTrials:1,activeLearners:1,teamMembers:1,payingLearners:1}),bind(...values){
   return {
    first:async()=>{
     if(sql.includes("FROM sessions s JOIN users u"))return {id:userId,email:"owner@example.com",role,staffActive:active,permissionsJson:JSON.stringify(permissions)};
     if(sql.includes("COUNT(*) AS n FROM users"))return {n:2};
     if(sql.includes("(SELECT COUNT(*) FROM users) AS total"))return {total:2,activeTrials:1,activeLearners:1,teamMembers:1,payingLearners:1};
     if(sql.includes("SELECT id FROM users WHERE id=?"))return {id:values[0]};
     if(sql.includes("WHERE u.id=? AND u.auth_provider <> 'deleted'")&&sql.includes("COALESCE(s.active,0) AS staffActive"))
      return exists?{id:values[0],email:"student@example.com",role:targetRole,staffActive:targetActive}:null;
     if(sql.includes("SELECT u.id,u.email")&&sql.includes("AS paymentOrders"))
      return exists?{id:values[0],email:"student@example.com",role:targetRole,staffActive:targetActive,paymentOrders}:null;
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
 return {env,statements,runs,batches};
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

test("Owner can delete a user without payment history in an atomic batch",async()=>{
 const m=mock();
 const response=await deleteUser(context(m,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{deleted:true,retainedPaymentRecords:false});
 assert.equal(m.batches.length,1);
 const sql=m.runs.map(x=>x.sql).join("\n");
 for(const table of ["sessions","google_identities","lesson_progress","enrollments","staff","email_challenges","users"])
  assert.match(sql,new RegExp("DELETE FROM "+table));
 assert.equal(m.runs.some(x=>x.sql.includes("UPDATE users")),false);
});
test("Payment history is never removed; account is anonymized instead",async()=>{
 const m=mock({paymentOrders:2});
 const response=await deleteUser(context(m,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:" STUDENT@EXAMPLE.COM "}
 }));
 assert.equal(response.status,200);
 assert.equal((await response.json()).retainedPaymentRecords,true);
 assert.equal(m.runs.some(x=>x.sql.includes("DELETE FROM users WHERE")),false);
 assert.equal(m.runs.some(x=>x.sql.includes("DELETE FROM payment_orders")),false);
 const update=m.runs.find(x=>x.sql.includes("UPDATE users"));
 assert.ok(update);
 assert.match(update.values[0],/^deleted-[0-9a-f-]+@accounts\.invalid$/);
 assert.equal(update.values[1],"student-1");
 assert.match(update.sql,/auth_provider='deleted'/);
});
test("Deletion requires verified exact-email confirmation and same-site origin",async()=>{
 const m=mock();
 const wrong=await deleteUser(context(m,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"other@example.com"}
 }));
 assert.equal(wrong.status,400);
 const badContext=context(m,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 });
 badContext.request=new Request(base+"/api/admin/users/student-1",{
  method:"DELETE",headers:{Cookie:"infrarivet_session="+cookie,Origin:"https://evil.test","Content-Type":"application/json"},
  body:JSON.stringify({confirmEmail:"student@example.com"})
 });
 assert.equal((await deleteUser(badContext)).status,403);
 assert.equal(m.batches.length,0);
});
test("Only owner can delete; self, other owner and active team accounts are protected",async()=>{
 const staff=mock({role:"staff"});
 assert.equal((await deleteUser(context(staff,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }))).status,403);
 const owner=mock();
 const selfContext=context(owner,"/api/admin/users/owner-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 });selfContext.params.id="owner-1";
 assert.equal((await deleteUser(selfContext)).status,403);
 const otherOwner=mock({targetRole:"owner"});
 assert.equal((await deleteUser(context(otherOwner,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }))).status,403);
 const activeStaff=mock({targetRole:"staff",targetActive:1});
 assert.equal((await deleteUser(context(activeStaff,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }))).status,409);
 for(const m of [staff,owner,otherOwner,activeStaff])assert.equal(m.batches.length,0);
});
test("Deleted and unknown users are not returned by admin endpoints",async()=>{
 const m=mock({exists:false});
 const r=await deleteUser(context(m,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }));
 assert.equal(r.status,404);
 assert.equal(m.batches.length,0);
 const listed=await listUsers(context(m,"/api/admin/users"));
 assert.equal(listed.status,200);
 assert.equal(m.statements.some(sql=>sql.includes("u.auth_provider <> 'deleted'")),true);
});

test("Delegated student managers may manage ordinary users, but not the owner or admins",async()=>{
 const staff=mock({role:"staff",permissions:["users.manage"]});
 const listed=await listUsers(context(staff,"/api/admin/users"));
 assert.equal(listed.status,200);
 assert.equal(staff.statements.some(sql=>sql.includes("NOT EXISTS (SELECT 1 FROM staff st2")),true);
 const update=await updateUser(context(staff,"/api/admin/users/student-1",{
  method:"PUT",body:{displayName:"Changed by admin"}
 }));
 assert.equal(update.status,200);
 const removed=await deleteUser(context(staff,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }));
 assert.equal(removed.status,200);
 const ownerTarget=mock({role:"staff",permissions:["users.manage"],targetRole:"owner"});
 const blocked=await updateUser(context(ownerTarget,"/api/admin/users/student-1",{
  method:"PUT",body:{displayName:"Not allowed"}
 }));
 assert.equal(blocked.status,403);
 assert.equal((await deleteUser(context(ownerTarget,"/api/admin/users/student-1",{
  method:"DELETE",body:{confirmEmail:"student@example.com"}
 }))).status,403);
 const adminTarget=mock({role:"staff",permissions:["users.manage"],targetRole:"staff",targetActive:1});
 assert.equal((await updateUser(context(adminTarget,"/api/admin/users/student-1",{
  method:"PUT",body:{trialExpiresAt:null}
 }))).status,403);
 assert.equal(adminTarget.runs.length,0);
});
