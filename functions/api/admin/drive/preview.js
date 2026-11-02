import {requireUser,requireStaff,checkOrigin,bodyJson,json,errorResponse,fail} from "../../../_lib/core.js";
import {folderIdFrom,driveToken,listDriveVideos} from "../../../_lib/drive-import.js";

// Discovery is read-only and never creates an R2 object or lecture.
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const user=await requireUser(ctx);requireStaff(user,"lectures.manage");
  if(!ctx.env.DB)fail(503,"Database is not configured");
  const body=await bodyJson(ctx.request);
  const courseId=String(body.courseId||"");
  if(!/^[\w-]{1,160}$/.test(courseId))fail(400,"Select a destination course or folder");
  const course=await ctx.env.DB.prepare("SELECT id,title FROM courses WHERE id=?").bind(courseId).first();
  if(!course)fail(404,"Destination course/folder not found");
  const folderId=folderIdFrom(body.folderUrl);
  const result=await listDriveVideos(driveToken(ctx.request),folderId);
  const [previous,lectures]=await Promise.all([
   ctx.env.DB.prepare("SELECT drive_file_id AS id,state FROM drive_import_items WHERE course_id=?").bind(courseId).all(),
   ctx.env.DB.prepare("SELECT title FROM lectures WHERE course_id=?").bind(courseId).all()
  ]);
  const imports=new Map((previous.results||[]).map(f=>[f.id,f.state]));
  const titles=new Set((lectures.results||[]).map(l=>String(l.title).trim().toLowerCase()));
  return json({courseId,courseTitle:course.title,folder:result.folder,
   files:result.files.map(f=>({...f,alreadyImported:imports.get(f.id)||null,
    titleExists:titles.has(f.suggestedTitle.toLowerCase())}))});
 }catch(e){return errorResponse(e)}
}
