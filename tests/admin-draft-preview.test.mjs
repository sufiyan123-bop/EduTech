import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as courseDetails} from "../functions/api/courses/[courseId].js";

const base="https://infrarivet.pages.dev",cookie="a".repeat(64);
function context({published=false,signedIn=true,role="owner",active=1,permissions=[],folder=false,exists=true}={}){
 const root=exists?{id:"devops",title:"Devops",description:"Master course",published:published?1:0,
   status:"available",price:999,details_json:folder?'{"folderOnly":true}':'{"level":"Beginner"}'}:null;
 const sqls=[];
 return {
  params:{courseId:"devops"},
  request:new Request(base+"/api/courses/devops",{headers:signedIn?{Cookie:"infrarivet_session="+cookie}:{}}),
  sqls,env:{DB:{prepare(sql){
   sqls.push(sql);
   return {bind(...args){
    return {
     async first(){
      if(sql.includes("FROM courses WHERE id=?"))return root;
      if(sql.includes("FROM sessions s JOIN users u"))return {id:"admin-1",email:"admin@example.com",role,staffActive:active,permissionsJson:JSON.stringify(permissions)};
      return null;
     },
     async all(){
      if(sql.includes("FROM course_inclusions"))return {results:[{id:"python",title:"Python with Linux"}]};
      if(sql.includes("FROM lectures"))return {results:[{id:args[0]+"-lesson",title:"First lesson",trialEnabled:0}]};
      return {results:[]};
     }
    };
   }};
  }}}
 };
}
test("An authenticated owner can preview DevOps draft and included syllabus without publishing",async()=>{
 const ctx=context();
 const response=await courseDetails(ctx);
 assert.equal(response.status,200);
 assert.match(response.headers.get("Cache-Control"),/private, no-store/);
 const data=await response.json();
 assert.equal(data.course.title,"Devops");
 assert.equal(data.course.published,false);
 assert.deepEqual(data.modules.map(m=>m.title),["Devops","Python with Linux"]);
 assert.equal(ctx.sqls.some(s=>s.includes("FROM lectures")),true);
});
test("An admin with courses.view permission can privately preview an unpublished course",async()=>{
 const response=await courseDetails(context({role:"staff",permissions:["courses.view"]}));
 assert.equal(response.status,200);
 assert.equal((await response.json()).course.published,false);
});
test("A visitor, student, or inactive staff cannot inspect any unpublished course syllabus",async()=>{
 for(const options of [
  {signedIn:false},{role:null,active:0},{role:"staff",permissions:["lectures.manage"],active:0},
  {role:"staff",permissions:[]}
 ]){
  const ctx=context(options);
  const response=await courseDetails(ctx);
  assert.equal(response.status,404);
  assert.equal(ctx.sqls.some(s=>s.includes("FROM lectures")),false);
 }
});
test("Published standalone courses remain accessible to anonymous visitors",async()=>{
 const response=await courseDetails(context({published:true,signedIn:false}));
 assert.equal(response.status,200);
 assert.match(response.headers.get("Cache-Control"),/public, max-age=60/);
 const data=await response.json();
 assert.equal(data.course.published,true);
});
test("Private folders cannot be visited directly as course pages, even by an owner",async()=>{
 const response=await courseDetails(context({folder:true}));
 assert.equal(response.status,404);
});
test("Unknown draft IDs remain hidden",async()=>{
 const response=await courseDetails(context({exists:false}));
 assert.equal(response.status,404);
});
