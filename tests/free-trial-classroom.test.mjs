import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as classroom} from "../functions/api/learn/[courseId].js";

const cookie="a".repeat(64);
function context({signedIn=true,published=1,status="available",enrolled=false,admin=false}={}){
 const root={id:"master",title:"Master Course",published,status};
 const child={id:"folder",title:"Included Folder",published:0};
 const recorded=[];
 const db={prepare(sql){
  return {bind(...args){
   recorded.push({sql,args});
   return {
    async first(){
     if(sql.includes("FROM sessions s JOIN users u"))
      return {id:"learner",email:"student@example.com",role:admin?"owner":null,staffActive:admin?1:0,trialExpiresAt:null};
     if(sql.includes("FROM courses WHERE id=?"))return root;
     if(sql.includes("FROM enrollments e"))return {direct:enrolled?1:0,bundled:0};
     return null;
    },
    async all(){
     if(sql.includes("FROM course_inclusions i JOIN courses c"))return {results:[child]};
     if(sql.includes("FROM lectures l JOIN courses c")){
      const isChild=args[1]==="folder";
      return {results:[{
       id:isChild?"folder-trial":"root-trial",title:"Try this",trialEnabled:1,freePreview:0,
       completed:0,price:isChild?0:3500,published:isChild?0:published,
       details_json:isChild?'{"folderOnly":true}':"{}",status:isChild?"available":status,order:1
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
test("Purchased students see all lessons across their master course and included folder",async()=>{
 const r=await classroom(context({enrolled:true}));
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.modules.length,2);
 assert.equal(data.previewOnly,false);
 assert.deepEqual(data.modules.map(m=>m.lessons.map(l=>[l.trialEnabled,l.locked])),[
  [[true,false],[false,false]],
  [[true,false],[false,false]]
 ]);
});
test("Trial lesson listing still requires login",async()=>{
 assert.equal((await classroom(context({signedIn:false}))).status,401);
});
test("Coming-soon master does not reveal any trial lesson details to a non-buyer",async()=>{
 const ctx=context({status:"comingSoon"});
 const r=await classroom(ctx);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.previewOnly,true);
 assert.deepEqual(data.modules.map(m=>m.lessons),[[],[]]);
 assert.equal(ctx.recorded.some(x=>x.sql.includes("FROM lectures")),false);
});
test("Unpublished master is hidden from non-enrolled users",async()=>{
 assert.equal((await classroom(context({published:0}))).status,404);
});

test("Unpurchased student classroom lists only folders, never trials, locked lessons or counts",async()=>{
 const ctx=context();
 const r=await classroom(ctx);
 assert.equal(r.status,200);
 const data=await r.json(),body=JSON.stringify(data);
 assert.equal(data.previewOnly,true);
 assert.deepEqual(data.modules.map(m=>m.title),["Master Course","Included Folder"]);
 assert.deepEqual(data.modules.map(m=>m.lessons),[[],[]]);
 assert.equal(data.progress,null);
 for(const hidden of ["Try this","Paid video","trialEnabled","completed","locked","root-paid","folder-trial","percent","total"])
  assert.equal(body.includes(hidden),false,hidden);
 assert.equal(ctx.recorded.some(x=>x.sql.includes("FROM lectures")),false);
});
test("Active administrator can inspect full classroom even without a paid enrollment",async()=>{
 const result=await classroom(context({admin:true}));
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.previewOnly,false);
 assert.equal(data.modules[0].lessons.length,2);
});
