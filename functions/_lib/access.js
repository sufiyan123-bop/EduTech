import { requireUser } from "./security.js";
export async function courseAccess(env,request,courseId){
 const user=await requireUser(env,request);
 const row=await env.DB.prepare(`SELECT e.course_id,e.expires_at FROM enrollments e
 WHERE e.user_id=? AND (e.expires_at IS NULL OR e.expires_at>unixepoch())
 AND (e.course_id=? OR EXISTS (
  SELECT 1 FROM course_inclusions i WHERE i.parent_course_id=e.course_id AND i.child_course_id=?
 )) LIMIT 1`).bind(user.id,courseId,courseId).first();
 return {user,enrolled:Boolean(row),enrollment:row};
}
export async function lectureAccess(env,request,courseId,lectureId){
 const {user,enrolled}=await courseAccess(env,request,courseId);
 const lecture=await env.DB.prepare(`SELECT id,course_id,title,trial_enabled,free_preview,youtube_id,r2_object_key
 FROM lectures WHERE course_id=? AND id=?`).bind(courseId,lectureId).first();
 if(!lecture)throw Object.assign(Error("Lecture not found"),{status:404});
 const course=await env.DB.prepare("SELECT published,price_inr FROM courses WHERE id=?").bind(courseId).first();
 if(!course?.published)throw Object.assign(Error("Course unavailable"),{status:404});
 const trial=Number(user.trialExpiresAt||0)>Math.floor(Date.now()/1000);
 const allowed=enrolled||(trial&&lecture.trial_enabled===1)||(Number(course.price_inr)===0&&lecture.free_preview===1);
 if(!allowed)throw Object.assign(Error("Active enrollment required"),{status:403});
 return {user,lecture,enrolled,trial};
}
