import {requireR2Capacity} from "../../../_lib/r2-quota.js";
import {requireUser,requireStaff,checkOrigin,bodyJson,json,fail,errorResponse} from "../../../_lib/core.js";
import {folderIdFrom,driveToken,listDriveVideos,cleanImportTitle,cleanChapter,MAX_ITEMS} from "../../../_lib/drive-import.js";

export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);requireStaff(user,"lectures.manage");
  if(!ctx.env.DB)fail(503,"Database is not configured");
  const courseId=String(new URL(ctx.request.url).searchParams.get("courseId")||"");
  if(!/^[\w-]{1,160}$/.test(courseId))fail(400,"Select a destination folder");
  const jobs=await ctx.env.DB.prepare(`SELECT j.id,j.course_id AS courseId,j.drive_folder_id AS driveFolderId,
     j.created_at AS createdAt,
     COUNT(i.id) AS total,
     SUM(CASE WHEN i.state='completed' THEN 1 ELSE 0 END) AS completed
     FROM drive_import_jobs j JOIN drive_import_items i ON i.job_id=j.id
     WHERE j.course_id=? GROUP BY j.id ORDER BY j.created_at DESC LIMIT 10`)
    .bind(courseId).all();
  const items=await ctx.env.DB.prepare(`SELECT i.id,i.job_id AS jobId,i.title,i.source_name AS sourceName,
     i.state,i.size_bytes AS sizeBytes,i.next_part AS nextPart,i.last_error AS error
     FROM drive_import_items i JOIN drive_import_jobs j ON j.id=i.job_id
     WHERE j.course_id=? ORDER BY j.created_at DESC,i.sort_order LIMIT 500`)
    .bind(courseId).all();
  return json({jobs:(jobs.results||[]).map(j=>({...j,items:(items.results||[]).filter(i=>i.jobId===j.id)}))});
 }catch(e){return errorResponse(e)}
}

export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const actor=await requireUser(ctx);requireStaff(actor,"lectures.manage");
  if(!ctx.env.DB||!ctx.env.VIDEOS)fail(503,"Private video storage or database is unavailable");
  const body=await bodyJson(ctx.request,50000);
  if(body.confirm!==true)fail(400,"Confirm the import plan before creating a job");
  const courseId=String(body.courseId||"");
  if(!/^[\w-]{1,160}$/.test(courseId))fail(400,"Invalid course/folder");
  const course=await ctx.env.DB.prepare("SELECT id,title FROM courses WHERE id=?").bind(courseId).first();
  if(!course)fail(404,"Destination course/folder not found");
  const folderId=folderIdFrom(body.folderUrl);
  const requested=body.files;
  if(!Array.isArray(requested)||!requested.length||requested.length>MAX_ITEMS)
   fail(400,"Select 1–100 Drive videos");
  if(requested.some(x=>!x||typeof x!=="object"||Array.isArray(x)))fail(400,"Invalid lecture list");
  const selectedIds=requested.map(x=>String(x.fileId||""));
  if(new Set(selectedIds).size!==selectedIds.length)fail(400,"Duplicate Drive file IDs");
  // Re-read Drive metadata so the client cannot forge a file, size or source folder.
  const scanned=await listDriveVideos(driveToken(ctx.request),folderId);
  const available=new Map(scanned.files.map(f=>[f.id,f]));
  const [existing,seen]=await Promise.all([
   ctx.env.DB.prepare("SELECT title FROM lectures WHERE course_id=?").bind(courseId).all(),
   ctx.env.DB.prepare("SELECT drive_file_id AS id FROM drive_import_items WHERE course_id=?").bind(courseId).all()
  ]);
  const titles=new Set((existing.results||[]).map(l=>String(l.title).trim().toLowerCase()));
  const driveIds=new Set((seen.results||[]).map(f=>f.id));
  const plan=[];
  for(const req of requested){
   const file=available.get(String(req.fileId||""));
   if(!file)fail(409,"One selected video is no longer in this Drive folder");
   if(driveIds.has(file.id))fail(409,file.name+" already has a prepared import. Resume the existing job.");
   const title=cleanImportTitle(req.title||file.suggestedTitle);
   if(titles.has(title.toLowerCase()))fail(409,"A lecture titled '"+title+"' already exists. Choose a different title or deselect it.");
   titles.add(title.toLowerCase());
   plan.push({file,title,chapter:cleanChapter(req.chapter)});
  }
  // Fail before creating import jobs that cannot fit inside the 9GB R2 budget.
  await requireR2Capacity(ctx.env.VIDEOS,plan.reduce((sum,p)=>sum+p.file.size,0));
  const last=await ctx.env.DB.prepare("SELECT COALESCE(MAX(sort_order),0) AS lastOrder FROM lectures WHERE course_id=?").bind(courseId).first();
  const jobId=crypto.randomUUID(),start=Number(last?.lastOrder||0);
  // Only a manifest is saved now. No Google Drive file is mutated and NO R2
  // upload starts until the admin explicitly presses Start/Resume.
  const statements=[ctx.env.DB.prepare(`INSERT INTO drive_import_jobs(id,course_id,created_by,drive_folder_id) VALUES(?,?,?,?)`)
   .bind(jobId,courseId,actor.id,folderId)];
  for(let index=0;index<plan.length;index++){
   const {file,title,chapter}=plan[index],itemId=crypto.randomUUID(),lectureId=crypto.randomUUID(),
    extension=file.mimeType==="video/webm"?"webm":"mp4";
   const key="lessons/"+courseId+"/drive-"+file.id+"-"+itemId+"."+extension;
   statements.push(ctx.env.DB.prepare(`INSERT INTO drive_import_items
    (id,job_id,course_id,drive_file_id,source_name,title,chapter,sort_order,mime_type,size_bytes,r2_key,lecture_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(itemId,jobId,courseId,file.id,file.name,title,chapter,
    start+index+1,file.mimeType,file.size,key,lectureId));
  }
  await ctx.env.DB.batch(statements);
  return json({jobId,prepared:plan.length,uploaded:0,
   message:"Import plan prepared. No videos transferred yet. Press Start/Resume to transfer."},201);
 }catch(e){return errorResponse(e)}
}
