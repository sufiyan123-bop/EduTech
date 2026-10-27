import {requireUser,noStore,respondError} from "../../_lib/security.js";
export async function onRequestGet({env,request}){
 try{
 const user=await requireUser(env,request);
 const {results}=await env.DB.prepare(`SELECT c.id,c.title,c.description,c.thumbnail,c.track,c.status,
 e.expires_at AS expiresAt,e.source,
 (SELECT COUNT(*) FROM course_inclusions i WHERE i.parent_course_id=c.id) AS includedCount
 FROM enrollments e JOIN courses c ON c.id=e.course_id
 WHERE e.user_id=? AND (e.expires_at IS NULL OR e.expires_at>unixepoch())
 ORDER BY e.starts_at DESC`).bind(user.id).all();
 return noStore({courses:results||[]});
 }catch(e){return respondError(e)}
}
