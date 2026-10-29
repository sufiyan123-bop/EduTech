import {bodyJson,checkOrigin,validateEmail,randomToken,hmacHex,fail,json,errorResponse} from "../../_lib/core.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const {email:raw,turnstileToken}=await bodyJson(ctx.request);
  const email=validateEmail(raw),env=ctx.env;
  if(!env.DB||!env.RESEND_API_KEY||!env.EMAIL_FROM||!env.OTP_HASH_SECRET||!env.TURNSTILE_SECRET)fail(503,"Email sign-in is not configured yet");
  const ip=ctx.request.headers.get("cf-connecting-ip")||"unknown";
  const challenge=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:String(turnstileToken||""),remoteip:ip})
  });
  const result=await challenge.json().catch(()=>({}));
  if(!result.success)fail(400,"Please complete the security check");
  const now=Math.floor(Date.now()/1000),previous=await env.DB.prepare("SELECT * FROM email_challenges WHERE email=?").bind(email).first();
  if(previous&&now-previous.last_sent_at<60)fail(429,"Please wait one minute before requesting another code");
  if(previous&&now-previous.window_start<3600&&previous.sent_count>=5)fail(429,"Too many codes requested. Try again later");
  // Uniform six-digit OTP via rejection sampling (no modulo bias).
  const sample=new Uint32Array(1),limit=Math.floor(0x100000000/1000000)*1000000;
  do{crypto.getRandomValues(sample)}while(sample[0]>=limit);
  const code=String(sample[0]%1000000).padStart(6,"0");
  const codeHash=await hmacHex(env.OTP_HASH_SECRET,email+":"+code);
  await env.DB.prepare(`INSERT INTO email_challenges
   (email,code_hash,expires_at,last_sent_at,sent_count,window_start,failed_attempts)
   VALUES(?,?,?,?,1,?,0)
   ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,
     last_sent_at=excluded.last_sent_at,sent_count=CASE WHEN email_challenges.window_start>? THEN email_challenges.sent_count+1 ELSE 1 END,
     window_start=CASE WHEN email_challenges.window_start>? THEN email_challenges.window_start ELSE excluded.window_start END,failed_attempts=0`
  ).bind(email,codeHash,now+600,now,now,now-3600,now-3600).run();
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:"Your InfraRivet Academy sign-in code",text:"Your InfraRivet Academy one-time code is "+code+". It expires in 10 minutes. Never share this code."})
  });
  if(!response.ok){
   await env.DB.prepare("DELETE FROM email_challenges WHERE email=? AND code_hash=?").bind(email,codeHash).run();
   console.error("Email provider failure",response.status);
   if(response.status===403)fail(503,"Email provider rejected this recipient or sender. The Resend testing sender only sends to your registered email; other students need an approved sending domain.");
   if(response.status===401)fail(503,"Email provider rejected the API key. Check Resend credentials.");
   fail(503,"Could not send your code. Try again later");
  }
  return json({sent:true,message:"Check your inbox for a 6-digit sign-in code."});
 }catch(e){return errorResponse(e)}
}
