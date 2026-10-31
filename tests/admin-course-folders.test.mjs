import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPost as createFolder,onRequestPatch as renameFolder,onRequestDelete as deleteFolder} from "../functions/api/admin/folders.js";
import {onRequestGet as catalog} from "../functions/api/courses/index.js";

const base="https://infrarivet.pages.dev",cookie="a".repeat(64);
function state({role="owner",permissions=[],nested=false,existingName=false,lessons=0,childCourse=false}={}){
 const courses=new Map([["devops",{id:"devops",title:"DevOps",track:"DevOps",published:1,details_json:"{}"}]]);
 const inclusions=childCourse?[{parent_course_id:"devops",child_course_id:"python",sort_order:0}]:[];
 if(childCourse)courses.set("python",{id:"python",title:"Python",track:"DevOps",published:1,details_json:"{}"});
 if(existingName){courses.set("linux",{id:"linux",title:"Linux",track:"DevOps",published:0,details_json:'{"folderOnly":true}'});inclusions.push({parent_course_id:"devops",child_course_id:"linux",sort_order:0})}
 const operations=[],env={DB:{
  prepare(sql){return {bind(...values){return {
   async first(){
    if(sql.includes("FROM sessions s JOIN users u"))return {id:"owner",email:"owner@example.com",role,staffActive:1,permissionsJson:JSON.stringify(permissions)};
    if(sql.includes("SELECT id,track,title FROM courses"))return courses.get(values[0])||null;
    if(sql.includes("SELECT 1 AS yes FROM course_inclusions WHERE child_course_id=?"))return nested?{yes:1}:null;
    if(sql.includes("SELECT 1 AS yes FROM course_inclusions i"))return inclusions.some(i=>i.parent_course_id===values[0]&&courses.get(i.child_course_id)?.title.toLowerCase()===values[1].toLowerCase()&&i.child_course_id!==values[2])?{yes:1}:null;
    if(sql.includes("COUNT(*) AS n FROM course_inclusions"))return {n:inclusions.filter(i=>i.parent_course_id===values[0]).length};
    if(sql.includes("SELECT c.id,c.title,c.details_json"))return inclusions.some(i=>i.parent_course_id===values[0]&&i.child_course_id===values[1])?courses.get(values[1])||null:null;
    if(sql.includes("(SELECT COUNT(*) FROM lectures"))return {lessons,enrollments:0,orders:0};
    return null;
   },
   async run(){
    operations.push({sql,values});
    if(sql.includes("INSERT INTO courses(")){courses.set(values[0],{id:values[0],title:values[1],track:values[3],published:0,details_json:values[4]})}
    if(sql.includes("INSERT INTO course_inclusions"))inclusions.push({parent_course_id:values[0],child_course_id:values[1],sort_order:inclusions.length});
    if(sql.includes("UPDATE courses SET title"))courses.get(values[1]).title=values[0];
    if(sql.includes("DELETE FROM courses WHERE id")){courses.delete(values[0]);for(let i=inclusions.length-1;i>=0;i--)if(inclusions[i].child_course_id===values[0])inclusions.splice(i,1)}
    return {meta:{changes:1}};
   }
  }},
  all:async()=>{
   if(sql.includes("SELECT c.id,c.title,c.description"))return {results:[...courses.values()].filter(c=>c.published===1&&JSON.parse(c.details_json||"{}").folderOnly!==true).map(c=>({...c,description:"",price:999,featured:0,homeOrder:1}))};
   if(sql.includes("SELECT i.parent_course_id AS parentId"))return {results:inclusions.map(i=>({parentId:i.parent_course_id,id:i.child_course_id,title:courses.get(i.child_course_id)?.title}))};
   return {results:[]};
  }
  }},
  async batch(statements){for(const statement of statements)await statement.run();return []}
 }};
 return {env,courses,inclusions,operations};
}
function ctx(s,method,body,origin=base){
 return {env:s.env,request:new Request(base+"/api/admin/folders",{
  method,headers:{Cookie:"infrarivet_session="+cookie,Origin:origin,"Content-Type":"application/json"},
  body:JSON.stringify(body)
 })};
}
test("Folder creation persists a private child in its master without copying videos",async()=>{
 const s=state();
 const response=await createFolder(ctx(s,"POST",{parentCourseId:"devops",name:"Linux"}));
 assert.equal(response.status,201);
 const j=await response.json();
 assert.equal(s.inclusions.length,1);
 assert.equal(s.inclusions[0].child_course_id,j.id);
 assert.equal(JSON.parse(s.courses.get(j.id).details_json).folderOnly,true);
 assert.equal(s.courses.get(j.id).published,0);
 assert.equal(s.operations.some(o=>o.sql.includes("INSERT INTO lectures")),false);
 const renamed=await renameFolder(ctx(s,"PATCH",{parentCourseId:"devops",folderId:j.id,name:"Linux Deep Dive"}));
 assert.equal(renamed.status,200);
 assert.equal(s.courses.get(j.id).title,"Linux Deep Dive");
 const removed=await deleteFolder(ctx(s,"DELETE",{parentCourseId:"devops",folderId:j.id}));
 assert.equal(removed.status,200);
 assert.equal(s.courses.has(j.id),false);
 assert.equal(s.courses.has("devops"),true);
});
test("Existing folder names, nested masters and arbitrary existing courses are protected",async()=>{
 const dup=state({existingName:true});
 assert.equal((await createFolder(ctx(dup,"POST",{parentCourseId:"devops",name:"linux"}))).status,409);
 const nested=state({nested:true});
 assert.equal((await createFolder(ctx(nested,"POST",{parentCourseId:"devops",name:"Python"}))).status,409);
 const s=state({childCourse:true});
 assert.equal((await renameFolder(ctx(s,"PATCH",{parentCourseId:"devops",folderId:"python",name:"Changed"}))).status,404);
 assert.equal((await deleteFolder(ctx(s,"DELETE",{parentCourseId:"devops",folderId:"python"}))).status,404);
 assert.equal(s.courses.get("python").title,"Python");
});
test("Folders with lessons cannot be deleted, and no student videos are removed",async()=>{
 const s=state({existingName:true,lessons:4});
 assert.equal((await deleteFolder(ctx(s,"DELETE",{parentCourseId:"devops",folderId:"linux"}))).status,409);
 assert.equal(s.courses.has("linux"),true);
 assert.equal(s.operations.some(o=>o.sql.includes("DELETE")),false);
});
test("Folder management requires valid admin permission, session and same-origin write",async()=>{
 const student=state({role:null});
 assert.equal((await createFolder(ctx(student,"POST",{parentCourseId:"devops",name:"Linux"}))).status,403);
 const viewer=state({role:"staff",permissions:["lectures.manage"]});
 assert.equal((await createFolder(ctx(viewer,"POST",{parentCourseId:"devops",name:"Linux"}))).status,403);
 const manager=state({role:"staff",permissions:["courses.manage"]});
 assert.equal((await createFolder(ctx(manager,"POST",{parentCourseId:"devops",name:"Linux"},"https://evil.test"))).status,403);
 assert.equal(manager.operations.length,0);
});
test("Live catalog still lists published standalone included courses but hides private folders",async()=>{
 const s=state({childCourse:true,existingName:true});
 // Existing independently purchasable Python remains in the catalog.
 const result=await catalog({env:s.env});
 assert.equal(result.status,200);
 const names=(await result.json()).courses.map(c=>c.title);
 assert.ok(names.includes("DevOps"));
 assert.ok(names.includes("Python"));
 assert.equal(names.includes("Linux"),false);
});
