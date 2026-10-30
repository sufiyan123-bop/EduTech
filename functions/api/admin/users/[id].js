import {requireUser,checkOrigin,bodyJson,fail,json,errorResponse} from "../../../_lib/core.js";
import {requireOwner} from "./index.js";

function userId(ctx){
 const id=String(ctx.params.id||"");
 if(!id||id.length>160)fail(400,"Invalid user ID");
 return id;
}
export async function onRequestGet(ctx){
 try{
  const owner=await requireUser(ctx);requireOwner(owner);
  const id=userId(ctx);
  const [profile,access,payments,activity]=await Promise.all([
   ctx.env.DB.prepare(`SELECT u.id,u.email,u.display_name AS displayName,
    u.auth_provider AS authProvider,u.created_at AS createdAt,
    u.trial_expires_at AS trialExpiresAt,COALESCE(s.role,'student') AS role,
    COALESCE(s.active,0) AS staffActive
    FROM users u LEFT JOIN staff s ON s.user_id=u.id WHERE u.id=?`).bind(id).first(),
   ctx.env.DB.prepare(`SELECT e.course_id AS courseId,c.title,e.source,
      e.starts_at AS startsAt,e.expires_at AS expiresAt
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    WHERE e.user_id=? ORDER BY e.starts_at DESC LIMIT 100`).bind(id).all(),
   ctx.env.DB.prepare(`SELECT po.course_id AS courseId,c.title,po.amount_paise AS amountPaise,
      po.months,po.state,po.created_at AS createdAt,po.verified_at AS verifiedAt
     FROM payment_orders po JOIN courses c ON c.id=po.course_id
     WHERE po.user_id=? ORDER BY po.created_at DESC LIMIT 30`).bind(id).all(),
   ctx.env.DB.prepare(`SELECT
       (SELECT COUNT(*) FROM sessions WHERE user_id=? AND expires_at>unixepoch()) AS activeSessions,
       (SELECT MAX(created_at) FROM sessions WHERE user_id=?) AS lastSessionAt,
       (SELECT COUNT(*) FROM lesson_progress WHERE user_id=? AND completed=1) AS completedLessons
    `).bind(id,id,id).first()
  ]);
  if(!profile)fail(404,"User not found");
  return json({user:profile,enrollments:access.results||[],
    payments:payments.results||[],activity},200,{"Cache-Control":"no-store"});
 }catch(e){return errorResponse(e)}
}
export async function onRequestPut(ctx){
 try{
  checkOrigin(ctx.request);
  const owner=await requireUser(ctx);requireOwner(owner);
  const id=userId(ctx),body=await bodyJson(ctx.request);
  const keys=Object.keys(body);
  if(!keys.length||keys.some(k=>!["displayName","trialExpiresAt"].includes(k)))
   fail(400,"Only display name and trial expiry can be edited");
  const current=await ctx.env.DB.prepare("SELECT id FROM users WHERE id=?").bind(id).first();
  if(!current)fail(404,"User not found");
  if(Object.prototype.hasOwnProperty.call(body,"displayName")){
   if(typeof body.displayName!=="string")fail(400,"Enter a valid display name");
   const name=body.displayName.trim();
   if(!name||name.length>120||/[\u0000-\u001f\u007f]/.test(name))
    fail(400,"Display name must contain 1–120 printable characters");
   await ctx.env.DB.prepare("UPDATE users SET display_name=? WHERE id=?").bind(name,id).run();
  }
  if(Object.prototype.hasOwnProperty.call(body,"trialExpiresAt")){
   const expiry=body.trialExpiresAt;
   const max=Math.floor(Date.now()/1000)+365*3*86400;
   if(expiry!==null&&(!Number.isSafeInteger(expiry)||expiry<0||expiry>max))
    fail(400,"Choose a valid trial expiry within 3 years or clear the trial");
   await ctx.env.DB.prepare("UPDATE users SET trial_expires_at=? WHERE id=?").bind(expiry,id).run();
  }
  return json({saved:true});
 }catch(e){return errorResponse(e)}
}
