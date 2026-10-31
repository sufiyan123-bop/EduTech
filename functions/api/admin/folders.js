import {requireUser,requireStaff,checkOrigin,bodyJson,json,fail,errorResponse} from "../../_lib/core.js";

function nameOf(body){
 const name=String(body.name||"").trim();
 if(!name||name.length>120)fail(400,"Folder name must be 1–120 characters");
 return name;
}
function idOf(value){
 if(typeof value!=="string"||!value.trim()||value.length>160)fail(400,"Invalid course or folder ID");
 return value.trim();
}
async function parentCourse(db,parentId){
 const parent=await db.prepare("SELECT id,track,title FROM courses WHERE id=?").bind(parentId).first();
 if(!parent)fail(404,"Master course not found");
 const nested=await db.prepare("SELECT 1 AS yes FROM course_inclusions WHERE child_course_id=? LIMIT 1").bind(parentId).first();
 if(nested)fail(409,"Create folders inside the master course, not inside another folder");
 return parent;
}
async function folderCourse(db,parentId,folderId){
 const folder=await db.prepare(`SELECT c.id,c.title,c.details_json
  FROM courses c JOIN course_inclusions i ON i.child_course_id=c.id
  WHERE i.parent_course_id=? AND c.id=?`).bind(parentId,folderId).first();
 if(!folder||JSON.parse(folder.details_json||"{}").folderOnly!==true)
  fail(404,"Private course folder not found");
 return folder;
}
async function uniqueName(db,parentId,name,exceptId=""){
 const duplicate=await db.prepare(`SELECT 1 AS yes FROM course_inclusions i
  JOIN courses c ON c.id=i.child_course_id
  WHERE i.parent_course_id=? AND c.title=? COLLATE NOCASE AND c.id<>? LIMIT 1`)
  .bind(parentId,name,exceptId).first();
 if(duplicate)fail(409,"A folder or included course with that name already exists");
}
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const admin=await requireUser(ctx);requireStaff(admin,"courses.manage");
  const body=await bodyJson(ctx.request);
  const parentId=idOf(body.parentCourseId),name=nameOf(body);
  const db=ctx.env.DB,parent=await parentCourse(db,parentId);
  await uniqueName(db,parentId,name);
  const count=await db.prepare("SELECT COUNT(*) AS n FROM course_inclusions WHERE parent_course_id=?").bind(parentId).first();
  if(Number(count?.n||0)>=100)fail(409,"A master course can contain up to 100 folders or courses");
  const folderId=crypto.randomUUID();
  // A folder is an unpublished child course; existing enrollments and videos
  // are never copied or moved. Master-course purchases unlock it via inclusions.
  await db.batch([
   db.prepare(`INSERT INTO courses(id,title,description,track,price_inr,thumbnail,published,status,
    featured,sort_order,details_json) VALUES(?,?,?, ?,0,'',0,'available',0,999,?)`)
    .bind(folderId,name,"",parent.track||"",JSON.stringify({folderOnly:true})),
   db.prepare(`INSERT INTO course_inclusions(parent_course_id,child_course_id,sort_order)
    VALUES(?,?,COALESCE((SELECT MAX(sort_order)+1 FROM course_inclusions WHERE parent_course_id=?),0))`)
    .bind(parentId,folderId,parentId)
  ]);
  return json({id:folderId,parentCourseId:parentId,name,created:true},201);
 }catch(e){return errorResponse(e)}
}
export async function onRequestPatch(ctx){
 try{
  checkOrigin(ctx.request);
  const admin=await requireUser(ctx);requireStaff(admin,"courses.manage");
  const body=await bodyJson(ctx.request),parentId=idOf(body.parentCourseId),
   folderId=idOf(body.folderId),name=nameOf(body);
  const db=ctx.env.DB;
  await folderCourse(db,parentId,folderId);
  await uniqueName(db,parentId,name,folderId);
  await db.prepare("UPDATE courses SET title=?,updated_at=unixepoch() WHERE id=?")
   .bind(name,folderId).run();
  return json({renamed:true,id:folderId});
 }catch(e){return errorResponse(e)}
}
export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);
  const admin=await requireUser(ctx);requireStaff(admin,"courses.manage");
  const body=await bodyJson(ctx.request),parentId=idOf(body.parentCourseId),
   folderId=idOf(body.folderId),db=ctx.env.DB;
  await folderCourse(db,parentId,folderId);
  const usage=await db.prepare(`SELECT
    (SELECT COUNT(*) FROM lectures WHERE course_id=?) AS lessons,
    (SELECT COUNT(*) FROM enrollments WHERE course_id=?) AS enrollments,
    (SELECT COUNT(*) FROM payment_orders WHERE course_id=?) AS orders`)
   .bind(folderId,folderId,folderId).first();
  if(Number(usage?.lessons||0)>0||Number(usage?.enrollments||0)>0||Number(usage?.orders||0)>0)
   fail(409,"Folder contains lessons, enrollments or payments. Its content is protected.");
  await db.prepare("DELETE FROM courses WHERE id=?").bind(folderId).run();
  return json({removed:true,id:folderId});
 }catch(e){return errorResponse(e)}
}
