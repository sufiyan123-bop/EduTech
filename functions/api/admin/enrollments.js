import {requireUser,requireStaff,checkOrigin,bodyJson,validateEmail,asTime,protectOwnerAccount,json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  const u=await requireUser(ctx);requireStaff(u,"enrollments.manage");
  const r=await ctx.env.DB.prepare(`SELECT e.user_id AS userId,u.email,e.course_id AS courseId,c.title,
   e.source,e.starts_at AS startsAt,e.expires_at AS expiresAt
   FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
   ORDER BY e.starts_at DESC LIMIT 500`).all();
  return json({enrollments:r.results||[]});
 }catch(e){return errorResponse(e)}
}
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"enrollments.manage");
  const d=await bodyJson(ctx.request),email=validateEmail(d.email),courseId=String(d.courseId||""),expires=asTime(d.expiresAt);
  await protectOwnerAccount(ctx.env,u,{email});
  if(d.expiresAt&&!expires)fail(400,"Invalid expiry date");
  if(expires&&expires<=Math.floor(Date.now()/1000))fail(400,"Expiry must be in the future");
  const course=await ctx.env.DB.prepare("SELECT id FROM courses WHERE id=?").bind(courseId).first();
  if(!course)fail(404,"Course not found");
  let student=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  if(!student){
   await ctx.env.DB.prepare("INSERT INTO users(id,email,display_name,auth_provider) VALUES(?,?,?,'pending_otp') ON CONFLICT(email) DO NOTHING").bind(crypto.randomUUID(),email,email.split("@")[0]).run();
   student=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  }
  await ctx.env.DB.prepare(`INSERT INTO enrollments(user_id,course_id,source,starts_at,expires_at) VALUES(?,?,'admin',unixepoch(),?)
    ON CONFLICT(user_id,course_id) DO UPDATE SET source='admin',expires_at=excluded.expires_at`).bind(student.id,courseId,expires).run();
  return json({granted:true,userId:student.id});
 }catch(e){return errorResponse(e)}
}
export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"enrollments.manage");
  const d=await bodyJson(ctx.request);
  await protectOwnerAccount(ctx.env,u,{userId:String(d.userId||"")});
  await ctx.env.DB.prepare("DELETE FROM enrollments WHERE user_id=? AND course_id=?").bind(String(d.userId||""),String(d.courseId||"")).run();
  return json({revoked:true});
 }catch(e){return errorResponse(e)}
}
