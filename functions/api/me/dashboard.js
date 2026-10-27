import {requireUser,json,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);
  const result=await ctx.env.DB.prepare(`SELECT c.id,c.title,c.description,c.thumbnail,c.track,c.price_inr AS price,
    c.status,e.expires_at AS expiresAt,
    (SELECT COUNT(*) FROM course_inclusions ci WHERE ci.parent_course_id=c.id) AS includedCount
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    WHERE e.user_id=? AND (e.expires_at IS NULL OR e.expires_at>unixepoch())
    ORDER BY e.starts_at DESC`).bind(user.id).all();
  return json({courses:result.results||[]});
 }catch(e){return errorResponse(e)}
}
