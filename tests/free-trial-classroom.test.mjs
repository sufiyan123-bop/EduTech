import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as classroom} from "../functions/api/learn/[courseId].js";

const cookie="a".repeat(64);
function context({signedIn=true,published=1,status="available"}={}){
 const root={id:"master",title:"Master Course",published,status};
 const child={id:"folder",title:"Included Folder",published:0};
 const recorded=[];
 const db={prepare(sql){
  return {bind(...args){
   recorded.push({sql,args});
   return {
    async first(){
     if(sql.includes("FROM sessions s JOIN users u"))
      return {id:"learner",email:"student@example.com",role:null,staffActive:0,trialExpiresAt:null};
     if(sql.includes("FROM courses WHERE id=?"))return root;
     if(sql.includes("FROM enrollments e"))return {direct:0,bundled:0};
     return null;
    },
    async all(){
     if(sql.includes("FROM course_inclusions i JOIN courses c"))return {results:[child]};
     if(sql.includes("FROM lectures l JOIN courses c")){
      const isChild=args[1]==="folder";
      return {results:[{
       id:isChild?"folder-trial":"root-trial",title:"Try this",trialEnabled:1,freePreview:0,
       completed:0,price:isChild?0:3500,published:isChild?0:published,
       details_json:isChild?'{"folderOnly":true}':"{}",status:"available",order:1
      },{
       id:isChild?"folder-paid":"root-paid",title:"Paid video",trialEnabled:0,freePreview:0,
       completed:0,price:isChild?0:3500,published:isChild?0:published,
       details_json:isChild?'{"folderOnly":true}':"{}",status:"available",order:2
      }]};
     }
     return {results:[]};
    }
   };
  }};
 }};
 return {params:{courseId:"master"},request:new Request("https://infrarivet.pages.dev/api/learn/master",{
  headers:signedIn?{Cookie:"infrarivet_session="+cookie}:{}
 }),env:{DB:db},recorded};
}
test("Every logged-in student sees unlocked trial lessons across master course and included folder",async()=>{
 const r=await classroom(context());
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.modules.length,2);
 assert.deepEqual(data.modules.map(m=>m.lessons.map(l=>[l.trialEnabled,l.locked])),[
  [[true,false],[false,true]],
  [[true,false],[false,true]]
 ]);
});
test("Trial lesson listing still requires login",async()=>{
 assert.equal((await classroom(context({signedIn:false}))).status,401);
});
test("Coming-soon parent never exposes its trial lessons or unpublished child trial",async()=>{
 const r=await classroom(context({status:"comingSoon"}));
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.modules[0].lessons[0].locked,true);
 assert.equal(data.modules[1].lessons[0].locked,true);
});
test("Unpublished master is hidden from non-enrolled users",async()=>{
 assert.equal((await classroom(context({published:0}))).status,404);
});
