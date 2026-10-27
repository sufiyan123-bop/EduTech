/**
 * ONE-TIME DATA EXPORT TOOL: Firebase Auth/Firestore -> D1 SQL.
 * Run locally only, with GOOGLE_APPLICATION_CREDENTIALS pointing to a service
 * account JSON outside this repository. Never upload the generated SQL to GitHub.
 * Firebase data is read-only; this script does not delete or mutate Firebase.
 */
import {initializeApp,applicationDefault} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {mkdir,open,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Set GOOGLE_APPLICATION_CREDENTIALS to your local service-account JSON path.");
initializeApp({credential:applicationDefault()});
const db=getFirestore(),auth=getAuth(),SQL=[],counts={},userIds=new Set(),courseIds=new Set(),lectureIds=new Set();
const out=resolve(process.cwd(),"exports","edutech-d1.private.sql");
const q=v=>v==null?"NULL":"'"+String(v).replaceAll("\0","").replaceAll("'","''")+"'";
const n=v=>Number.isFinite(Number(v))?String(Number(v)):"NULL";
const bool=v=>v?1:0;
const epoch=x=>{
 if(!x)return null;
 if(typeof x.toMillis==="function")return Math.floor(x.toMillis()/1000);
 if(typeof x.seconds==="number")return Math.floor(x.seconds);
 if(x instanceof Date)return Math.floor(x.getTime()/1000);
 if(typeof x==="number")return x>9999999999?Math.floor(x/1000):Math.floor(x);
 if(typeof x==="string"){const t=Date.parse(x);return Number.isFinite(t)?Math.floor(t/1000):null;}
 return null;
};
function insert(table,fields,values){
 SQL.push("INSERT OR REPLACE INTO "+table+" ("+fields.join(",")+") VALUES ("+values.map((v,i)=>typeof v==="object"&&v!==null&&v.__sql?String(v.value):q(v)).join(",")+");");
 counts[table]=(counts[table]||0)+1;
}
const raw=v=>({__sql:true,value:v==null?"NULL":n(v)});
function json(v){return JSON.stringify(v||{});}
async function listAuthUsers(){
 const rows=[];let token;
 do{
  const batch=await auth.listUsers(1000,token);rows.push(...batch.users);token=batch.pageToken;
 }while(token);
 return rows;
}
console.log("Reading Firebase users and course data (no Firebase writes will be made)...");
const [accounts,userDocs,courseDocs,enrollDocs,progressDocs,staffDocs,trackDocs,orderDocs,ownerDoc]=await Promise.all([
 listAuthUsers(),db.collection("users").get(),db.collection("courses").get(),
 db.collection("enrollments").get(),db.collection("lessonProgress").get(),
 db.collection("staff").get(),db.collection("tracks").get(),
 db.collection("paymentOrders").get(),db.collection("system").doc("adminOwner").get()
]);
SQL.push("PRAGMA foreign_keys = ON;");
const userData=new Map(userDocs.docs.map(d=>[d.id,d.data()]));
const emails=new Set();
for(const account of accounts){
 const email=account.email?.trim().toLowerCase();if(!email){console.warn("Skipped Auth user with no email:",account.uid);continue}
 if(emails.has(email)){console.warn("Duplicate account email:",email);continue}
 emails.add(email);const profile=userData.get(account.uid)||{};
 insert("users",["id","email","display_name","auth_provider","created_at","trial_expires_at"],[
  account.uid,email,profile.name||profile.displayName||account.displayName||email.split("@")[0],
  "firebase_migrated",raw(epoch(account.metadata.creationTime)||Math.floor(Date.now()/1000)),raw(epoch(profile.trialExpiresAt))
 ]);userIds.add(account.uid);
}
for(const snap of userDocs.docs){
 if(userIds.has(snap.id))continue;
 const d=snap.data(),email=String(d.email||"").toLowerCase().trim();
 if(!email||emails.has(email))continue;
 insert("users",["id","email","display_name","auth_provider","created_at","trial_expires_at"],[
  snap.id,email,d.name||d.displayName||email.split("@")[0],"firebase_migrated",raw(epoch(d.createdAt)||Math.floor(Date.now()/1000)),raw(epoch(d.trialExpiresAt))
 ]);userIds.add(snap.id);emails.add(email);
}
for(const doc of courseDocs.docs){
 const d=doc.data();courseIds.add(doc.id);
 const details={level:d.level||"",language:d.language||"",duration:d.duration||"",instructor:d.instructor||"",
  badge:d.badge||"",folderOnly:!!d.folderOnly,plans:d.plans||{}};
 insert("courses",["id","title","description","track","price_inr","thumbnail","published","status","featured","sort_order","details_json"],[
  doc.id,d.title||"Untitled course",d.description||"",d.track||"",raw(Number(d.price)||0),
  d.thumbnail||"",raw(bool(d.published)),d.status||"available",raw(bool(d.featured)),raw(Number(d.homeOrder??999)),json(details)
 ]);
}
for(const doc of courseDocs.docs){
 const d=doc.data();
 for(const [i,childId] of [...new Set(d.includedCourseIds||[])].entries()){
  if(childId===doc.id||!courseIds.has(childId)){console.warn("Invalid included course link",doc.id,childId);continue;}
  insert("course_inclusions",["parent_course_id","child_course_id","sort_order"],[doc.id,childId,raw(i)]);
 }
}
for(const course of courseDocs.docs){
 const [privateLectures,catalog]=await Promise.all([
  db.collection("courses").doc(course.id).collection("lectures").get(),
  db.collection("courses").doc(course.id).collection("lectureCatalog").get()
 ]);
 const detailed=new Map(privateLectures.docs.map(d=>[d.id,d.data()]));
 const metadata=new Map(catalog.docs.map(d=>[d.id,d.data()]));
 const ids=new Set([...detailed.keys(),...metadata.keys()]);
 for(const id of ids){
  const d=detailed.get(id)||{},m=metadata.get(id)||{};
  lectureIds.add(course.id+"/"+id);
  insert("lectures",["id","course_id","title","chapter","sort_order","trial_enabled","free_preview","youtube_id","r2_object_key"],[
   id,course.id,m.title||d.title||"Lesson",m.chapter||d.chapter||m.section||d.section||"General",raw(Number(m.order??d.order??0)),raw(bool(m.trialEnabled??d.trialEnabled)),
   raw(bool(m.freePreview??d.freePreview)),d.youtubeId||null,null
  ]);
 }
}
for(const doc of enrollDocs.docs){
 const d=doc.data();
 if(["revoked","inactive","expired"].includes(d.status))continue;
 if(!userIds.has(d.userId)||!courseIds.has(d.courseId)){console.warn("Skipping orphan enrollment",doc.id);continue}
 const expires=epoch(d.expiresAt);
 if(d.source==="razorpay"&&!expires){console.warn("Skipping paid enrollment without expiry",doc.id);continue}
 insert("enrollments",["user_id","course_id","source","starts_at","expires_at"],[
  d.userId,d.courseId,d.source||"admin",raw(epoch(d.startsAt)||Math.floor(Date.now()/1000)),raw(expires)
 ]);
}
for(const doc of progressDocs.docs){
 const d=doc.data();
 if(!userIds.has(d.userId)||!lectureIds.has(d.courseId+"/"+d.lectureId))continue;
 insert("lesson_progress",["user_id","course_id","lecture_id","completed","manually_completed","watched_seconds","completed_at"],[
  d.userId,d.courseId,d.lectureId,raw(bool(d.completed)),raw(bool(d.manuallyCompleted)),
  raw(Number(d.watchedSeconds)||0),raw(epoch(d.completedAt))
 ]);
}
for(const doc of staffDocs.docs){
 const d=doc.data();if(!userIds.has(doc.id))continue;
 const old=d.permissions||[];
 const permissions=new Set(old);
 if(old.some(x=>x.startsWith("courses.")&&x!=="courses.view"))permissions.add("courses.manage");
 if(old.some(x=>x.startsWith("lectures.")))permissions.add("lectures.manage");
 if(old.some(x=>x.startsWith("enrollments.")||x.startsWith("students.")))permissions.add("enrollments.manage");
 insert("staff",["user_id","role","permissions_json","active"],[
  doc.id,"staff",json([...permissions]),raw(d.active===false?0:1)
 ]);
}
const owner=ownerDoc.exists?ownerDoc.data().uid:null;
if(owner&&userIds.has(owner))insert("staff",["user_id","role","permissions_json","active"],[owner,"owner",json(["*"]),raw(1)]);
else console.warn("Owner not found in Auth users; grant owner role manually after migration");
for(const doc of trackDocs.docs){
 const d=doc.data();if(!d.name)continue;
 insert("tracks",["id","name"],[doc.id,d.name]);
}
for(const doc of orderDocs.docs){
 const d=doc.data(),orderId=d.providerOrderId||doc.id;
 if(!orderId?.startsWith("order_")||!userIds.has(d.userId)||!courseIds.has(d.courseId))continue;
 insert("payment_orders",["id","user_id","course_id","razorpay_order_id","razorpay_payment_id","amount_paise","months","state","created_at","verified_at"],[
  doc.id,d.userId,d.courseId,orderId,d.providerPaymentId||null,
  raw(Number(d.amountPaise)||0),raw(Number(d.planMonths)||1),
  d.status==="paid"?"paid":"created",
  raw(epoch(d.createdAt)||Math.floor(Date.now()/1000)),raw(epoch(d.paidAt))
 ]);
}
// Wrangler D1 import manages statements; explicit BEGIN/COMMIT are not emitted.
await mkdir(resolve(process.cwd(),"exports"),{recursive:true,mode:0o700});
const f=await open(out,"w",0o600);try{await f.writeFile(SQL.join("\n")+"\n")}finally{await f.close()}
console.log("Private D1 SQL saved (DO NOT COMMIT):",out);
console.table(counts);
console.log("Next: back up this SQL securely, create your D1 database and import in isolated staging BEFORE live cutover.");
