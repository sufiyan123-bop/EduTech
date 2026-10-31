import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPut as reorder} from "../functions/api/admin/folders.js";
import {onRequestGet as adminCourses} from "../functions/api/admin/courses.js";
import {onRequestGet as publicCourse} from "../functions/api/courses/[courseId].js";
import {onRequestGet as classroom} from "../functions/api/learn/[courseId].js";

const origin="https://infrarivet.pages.dev",cookie="a".repeat(64);
const fixtures=[
 {childId:"python",title:"Python with Linux",sortOrder:0},
 {childId:"linux",title:"Linux Deep dive",sortOrder:1},
 {childId:"docker",title:"Docker",sortOrder:2}
];
function store({role="owner",active=1,permissions=[],nested=false,rootExists=true}={}){
 const children=fixtures.map(c=>({...c})),changes=[];
 const db={prepare(sql){
  const make=(params=[])=>({
   bind(...values){return make(values)},
   async first(){
    if(sql.includes("FROM sessions s JOIN users u"))return {id:"admin",email:"admin@infrarivet.test",role,staffActive:active,permissionsJson:JSON.stringify(permissions)};
    if(sql.includes("SELECT id,track,title FROM courses"))return rootExists?{id:"devops",title:"DevOps",track:"DevOps"}:null;
    if(sql.includes("SELECT 1 AS yes FROM course_inclusions WHERE child_course_id=?"))return nested?{yes:1}:null;
    if(sql.includes("FROM courses WHERE id=?"))return {id:"devops",title:"DevOps",published:1,status:"available",price:999,description:"",details_json:"{}"};
    if(sql.includes("FROM enrollments e"))return {direct:0,bundled:0};
    return null;
   },
   async all(){
    if(sql.includes("SELECT child_course_id AS childId FROM course_inclusions"))return {results:children.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(x=>({childId:x.childId}))};
    if(sql.includes("FROM course_inclusions i JOIN courses c")){
     return {results:children.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(x=>({id:x.childId,title:x.title,description:"",thumbnail:"",track:"",price:149,published:1}))};
    }
    if(sql.includes("SELECT * FROM courses"))return {results:[{id:"devops",title:"DevOps",published:1,status:"available",details_json:"{}"}]};
    if(sql.includes("SELECT parent_course_id,child_course_id FROM course_inclusions"))return {results:children.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(x=>({parent_course_id:"devops",child_course_id:x.childId}))};
    if(sql.includes("FROM lectures"))return {results:[]};
    return {results:[]};
   },
   async run(){
    changes.push({sql,params});
    if(sql.includes("UPDATE course_inclusions")&&params[1]==="devops"){
     const found=children.find(c=>c.childId===params[2]);
     if(found)found.sortOrder=params[0];
    }
    return {meta:{changes:1}};
   }
  });
  return make();
 },async batch(prepared){for(const statement of prepared)await statement.run();return []}};
 return {env:{DB:db},children,changes};
}
function ctx(data,ordered,options={}){
 const {originHeader=origin,method="PUT",parentCourseId="devops"}=options;
 return {env:data.env,request:new Request(origin+"/api/admin/folders",{
  method,headers:{Origin:originHeader,Cookie:"infrarivet_session="+cookie,"Content-Type":"application/json"},
  body:JSON.stringify({parentCourseId,orderedChildIds:ordered})
 })};
}
function titles(data){return data.children.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(c=>c.title)}
test("Owner can put Linux first, Python second; order is persisted without moving or deleting videos",async()=>{
 const data=store();
 const response=await reorder(ctx(data,["linux","python","docker"]));
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).orderedChildIds,["linux","python","docker"]);
 assert.deepEqual(titles(data),["Linux Deep dive","Python with Linux","Docker"]);
 assert.deepEqual(data.changes.map(c=>c.params),[[0,"devops","linux"],[1,"devops","python"],[2,"devops","docker"]]);
 assert.equal(data.changes.every(c=>c.sql.includes("UPDATE course_inclusions SET sort_order=")),true);
 assert.equal(data.changes.some(c=>/UPDATE courses|DELETE|lectures|enrollments|payment_orders/i.test(c.sql)),false);
});
test("Published course and classroom read the stored order for students",async()=>{
 const data=store();
 await reorder(ctx(data,["linux","python","docker"]));
 const courseResponse=await publicCourse({env:data.env,params:{courseId:"devops"},request:new Request(origin+"/api/courses/devops")});
 assert.equal(courseResponse.status,200);
 const publicData=await courseResponse.json();
 assert.equal(publicData.previewOnly,true);
 assert.deepEqual(publicData.modules.map(x=>x.title),["DevOps","Linux Deep dive","Python with Linux","Docker"]);
 const learnerEnv={DB:{prepare(sql){if(sql.includes("FROM sessions s JOIN users u"))return {bind:()=>({first:async()=>({id:"student",role:null,staffActive:0})})};return data.env.DB.prepare(sql)}}};
 const classroomResponse=await classroom({env:learnerEnv,params:{courseId:"devops"},request:new Request(origin+"/api/learn/devops",{headers:{Cookie:"infrarivet_session="+cookie}})});
 assert.equal(classroomResponse.status,200);
 const room=await classroomResponse.json();
 assert.equal(room.previewOnly,true);
 assert.deepEqual(room.modules.map(x=>x.title),["DevOps","Linux Deep dive","Python with Linux","Docker"]);
});
test("Admin course editor receives the same new included course ID sequence",async()=>{
 const data=store();
 await reorder(ctx(data,["linux","python","docker"]));
 const response=await adminCourses({env:data.env,request:new Request(origin+"/api/admin/courses",{headers:{Cookie:"infrarivet_session="+cookie}})});
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).courses[0].includedCourseIds,["linux","python","docker"]);
});
test("Reject missing, extra, foreign, duplicate or malformed children without modifying order",async()=>{
 const wrong=[
  ["linux","python"],
  ["linux","python","docker","another"],
  ["linux","python","foreign"],
  ["linux","linux","docker"],
  ["linux","python",10],
  "linux,python,docker"
 ];
 for(const ids of wrong){
  const data=store(),response=await reorder(ctx(data,ids));
  assert.ok([400,409].includes(response.status));
  assert.deepEqual(titles(data),["Python with Linux","Linux Deep dive","Docker"]);
  assert.equal(data.changes.length,0);
 }
});
test("Only active course managers can reorder a master, and origin must match",async()=>{
 for(const config of [
  {role:null,active:0},{role:"staff",permissions:["lectures.manage"]},
  {role:"staff",permissions:["courses.view"]},{role:"staff",permissions:["courses.manage"],active:0}
 ]){
  const data=store(config);
  assert.equal((await reorder(ctx(data,["linux","python","docker"]))).status,403);
  assert.equal(data.changes.length,0);
 }
 const manager=store({role:"staff",permissions:["courses.manage"]});
 assert.equal((await reorder(ctx(manager,["linux","python","docker"]))).status,200);
 const attack=store();
 assert.equal((await reorder(ctx(attack,["linux","python","docker"],{originHeader:"https://attacker.example"}))).status,403);
 assert.equal(attack.changes.length,0);
});
test("Reject unknown or nested master course without writes",async()=>{
 for(const props of [{nested:true},{rootExists:false}]){
  const data=store(props);
  const response=await reorder(ctx(data,["linux","python","docker"]));
  assert.ok([404,409].includes(response.status));
  assert.equal(data.changes.length,0);
 }
});
