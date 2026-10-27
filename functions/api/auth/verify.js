import {bodyJson,checkOrigin,validateEmail,hmacHex,verifyHmac,randomToken,sha256,sessionCookie,json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const {email:raw,code,name}=await bodyJson(ctx.request);
  const email=validateEmail(raw);
  if(!/^\d{6}$/.test(String(code||"")))fail(400,"Enter your 6-digit code");
  if(!ctx.env.DB||!ctx.env.OTP_HASH_SECRET)fail(503,"Sign-in is not configured");
  const challenge=await ctx.env.DB.prepare("SELECT * FROM email_challenges WHERE email=?").bind(email).first();
  const now=Math.floor(Date.now()/1000);
  if(!challenge||challenge.expires_at<now||challenge.failed_attempts>=5)fail(400,"Code expired or invalid. Request a new code");
  await ctx.env.DB.prepare("UPDATE email_challenges SET failed_attempts=failed_attempts+1 WHERE email=?").bind(email).run();
  if(!await verifyHmac(ctx.env.OTP_HASH_SECRET,email+":"+code,challenge.code_hash))fail(400,"Incorrect verification code");
  await ctx.env.DB.prepare("DELETE FROM email_challenges WHERE email=?").bind(email).run();
  const previous=await ctx.env.DB.prepare("SELECT id,email,display_name FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  let userId=previous?.id;
  if(!userId){
   userId=crypto.randomUUID();
   await ctx.env.DB.prepare(`INSERT INTO users(id,email,display_name,auth_provider) VALUES(?,?,?,'email_otp')
    ON CONFLICT(email) DO NOTHING`).bind(userId,email,String(name||"").trim().slice(0,100)||email.split("@")[0]).run();
   const existing=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
   userId=existing.id;
  }
  const token=randomToken(),hash=await sha256(token);
  await ctx.env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(hash,userId,now+60*60*24*14).run();
  return json({signedIn:true},{toString:()=>""} && 200,{"Set-Cookie":sessionCookie(ctx.request,token,60*60*24*14)});
 }catch(e){return errorResponse(e)}
}
