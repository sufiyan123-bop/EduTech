import {requireUser,getLessonAccess,checkOrigin,bodyJson,json,fail,errorResponse} from "../_lib/core.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const user=await requireUser(ctx),body=await bodyJson(ctx.request);
  const courseId=String(body.courseId||""),lectureId=String(body.lectureId||"");
  if(!courseId||courseId.length>160||!lectureId||lectureId.length>160)fail(400,"Invalid lecture");
  await getLessonAccess(ctx.env,user,courseId,lectureId);
  const seconds=Number.isFinite(Number(body.watchedSeconds))?Math.min(100000,Math.max(0,Number(body.watchedSeconds))):0;
  await ctx.env.DB.prepare(`INSERT INTO lesson_progress(user_id,course_id,lecture_id,completed,manually_completed,watched_seconds,completed_at)
   VALUES(?,?,?,1,?,?,unixepoch())
   ON CONFLICT(user_id,course_id,lecture_id) DO UPDATE SET completed=1,
    manually_completed=MAX(lesson_progress.manually_completed,excluded.manually_completed),
    watched_seconds=MAX(lesson_progress.watched_seconds,excluded.watched_seconds),
    completed_at=COALESCE(lesson_progress.completed_at,excluded.completed_at)`
  ).bind(user.id,courseId,lectureId,body.manual?1:0,seconds).run();
  return json({completed:true});
 }catch(e){return errorResponse(e)}
}
