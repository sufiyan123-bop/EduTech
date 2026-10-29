import {requireUser,getLessonAccess,fail,errorResponse} from "../../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);
  const lesson=await getLessonAccess(ctx.env,user,String(ctx.params.courseId||""),String(ctx.params.lectureId||""));
  if(!lesson.r2_object_key||!ctx.env.VIDEOS)fail(404,"Video not found");
  const range=ctx.request.headers.get("range");
  if(range&&!/^bytes=\d*-\d*$/.test(range))fail(416,"Invalid Range header");
  const object=await ctx.env.VIDEOS.get(lesson.r2_object_key,{range:ctx.request.headers});
  if(!object)fail(404,"Video not found");
  const headers=new Headers({"Accept-Ranges":"bytes"});
  object.writeHttpMetadata(headers);
  // Private lesson bytes must never be cached by shared/CDN caches or embedded
  // cross-origin. Object metadata must not override these security decisions.
  headers.set("Cache-Control","private, no-store, max-age=0");
  headers.set("Pragma","no-cache");
  headers.set("Vary","Cookie");
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Cross-Origin-Resource-Policy","same-origin");
  headers.set("X-Frame-Options","DENY");
  headers.set("Referrer-Policy","no-referrer");
  headers.set("X-Robots-Tag","noindex, noarchive");
  headers.set("Content-Disposition",'inline; filename="infrarivet-lesson.mp4"');
  headers.set("Content-Type",headers.get("Content-Type")||"video/mp4");
  const r=object.range;
  if(range&&r&&typeof r.offset==="number"){
   const length=r.length??(object.size-r.offset);
   headers.set("Content-Range",`bytes ${r.offset}-${r.offset+length-1}/${object.size}`);
   headers.set("Content-Length",String(length));
   return new Response(object.body,{status:206,headers});
  }
  headers.set("Content-Length",String(object.size));
  return new Response(object.body,{status:200,headers});
 }catch(e){return errorResponse(e)}
}
