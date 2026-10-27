import {requireUser,requireStaff,checkOrigin,fail,json,errorResponse} from "../../_lib/core.js";
export async function onRequestPut(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);requireStaff(user,"lectures.manage");
  if(!ctx.env.VIDEOS)fail(503,"Private R2 video bucket not configured");
  const courseId=String(ctx.request.headers.get("X-Course-Id")||"");
  const course=await ctx.env.DB.prepare("SELECT id FROM courses WHERE id=?").bind(courseId).first();
  if(!course)fail(404,"Course not found");
  const type=String(ctx.request.headers.get("Content-Type")||"");
  if(!["video/mp4","video/webm"].includes(type))fail(415,"Only MP4 or WebM videos are supported");
  const length=Number(ctx.request.headers.get("Content-Length")||0);
  if(!length||length>90*1024*1024)fail(413,"Video must be smaller than 90 MB");
  const extension=type==="video/webm"?"webm":"mp4";
  const key="lessons/"+courseId+"/"+crypto.randomUUID()+"."+extension;
  await ctx.env.VIDEOS.put(key,ctx.request.body,{httpMetadata:{contentType:type}});
  return json({r2ObjectKey:key});
 }catch(e){return errorResponse(e)}
}
