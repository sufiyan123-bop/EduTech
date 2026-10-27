import {requireUser,requireStaff,checkOrigin,bodyJson,validateEmail,fail,json,errorResponse} from "../../_lib/core.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const admin=await requireUser(ctx);requireStaff(admin,"enrollments.manage");
  const d=await bodyJson(ctx.request),email=validateEmail(d.email);
  const days=Number(d.days);
  if(!Number.isInteger(days)||days<1||days>30)fail(400,"Choose 1–30 trial days");
  let student=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  if(!student){
   await ctx.env.DB.prepare("INSERT INTO users(id,email,display_name,auth_provider) VALUES(?,?,?,'pending_otp') ON CONFLICT(email) DO NOTHING").bind(crypto.randomUUID(),email,email.split("@")[0]).run();
   student=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  }
  const expires=Math.floor(Date.now()/1000)+days*86400;
  await ctx.env.DB.prepare("UPDATE users SET trial_expires_at=? WHERE id=?").bind(expires,student.id).run();
  return json({granted:true,expiresAt:expires});
 }catch(e){return errorResponse(e)}
}
