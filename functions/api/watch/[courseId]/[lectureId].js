import {requireUser,getLessonAccess,json,fail,errorResponse} from "../../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx),courseId=String(ctx.params.courseId||""),lectureId=String(ctx.params.lectureId||"");
  const lesson=await getLessonAccess(ctx.env,user,courseId,lectureId);
  if(lesson.r2_object_key){
   if(!ctx.env.VIDEOS)fail(503,"Private video storage is not configured");
   return json({provider:"r2",url:"/api/stream/"+encodeURIComponent(courseId)+"/"+encodeURIComponent(lectureId)});
  }
  if(lesson.youtube_id&&/^[\w-]{11}$/.test(lesson.youtube_id))return json({provider:"youtube",youtubeId:lesson.youtube_id});
  fail(404,"Video is not uploaded yet");
 }catch(e){return errorResponse(e)}
}
