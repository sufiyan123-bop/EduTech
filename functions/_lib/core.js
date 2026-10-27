// Shared Cloudflare Pages Functions helpers. No Firebase dependencies.
export class HttpError extends Error { constructor(status, message){super(message);this.status=status;} }
export function fail(status,message){throw new HttpError(status,message);}
export function json(data,status=200,headers={}){return Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});}
export function errorResponse(e){if(!(e instanceof HttpError))console.error("EduTech API error",e);return json({error:e instanceof HttpError?e.message:"Service temporarily unavailable" },e instanceof HttpError?e.status:503);}
export async function bodyJson(request,limit=20000){
 const size=Number(request.headers.get("content-length")||0);
 if(size>limit)fail(413,"Request too large");
 const text=await request.text();
 if(text.length>limit)fail(413,"Request too large");
 try{const data=JSON.parse(text);if(!data||typeof data!=="object"||Array.isArray(data))throw Error();return data}catch{fail(400,"Invalid JSON body")}
}
export function checkOrigin(request){
 const origin=request.headers.get("Origin"), expected=new URL(request.url).origin;
 if(!origin||origin!==expected)fail(403,"Invalid request origin");
}
export function validateEmail(input){
 const email=String(input||"").trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,"Enter a valid email");
 return email;
}
export function randomToken(length=32){const bytes=crypto.getRandomValues(new Uint8Array(length));return Array.from(bytes,n=>n.toString(16).padStart(2,"0")).join("");}
export function toHex(buf){return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,"0")).join("");}
export async function sha256(value){return toHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
export async function hmacHex(secret,value){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return toHex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
}
export async function verifyHmac(secret,value,hexSignature){
 if(typeof hexSignature!=="string"||!/^[0-9a-f]{64}$/i.test(hexSignature))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const signature=new Uint8Array(hexSignature.match(/../g).map(x=>parseInt(x,16)));
 return crypto.subtle.verify("HMAC",key,signature,new TextEncoder().encode(value));
}
export function sessionCookie(request,value,maxAge){
 const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
 return "edutech_session="+value+"; HttpOnly; SameSite=Lax; Path=/; Max-Age="+maxAge+secure;
}
export async function optionalUser(ctx){
 if(!ctx.env.DB)return null;
 const cookie=ctx.request.headers.get("cookie")||"";
 const token=cookie.match(/(?:^|;\s*)edutech_session=([0-9a-f]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const hash=await sha256(token);
 const user=await ctx.env.DB.prepare(`SELECT u.id, u.email, u.display_name AS name,
 u.trial_expires_at AS trialExpiresAt, s.expires_at AS sessionExpiresAt,
 st.role, st.permissions_json AS permissionsJson, st.active AS staffActive
 FROM sessions s JOIN users u ON s.user_id=u.id
 LEFT JOIN staff st ON st.user_id=u.id
 WHERE s.token_hash=? AND s.expires_at>unixepoch()`).bind(hash).first();
 return user||null;
}
export async function requireUser(ctx){const user=await optionalUser(ctx);if(!user)fail(401,"Please sign in to continue");return user;}
export function publicUser(user){return {id:user.id,email:user.email,name:user.name,trialExpiresAt:user.trialExpiresAt,role:user.staffActive?user.role:null,permissions:user.staffActive?JSON.parse(user.permissionsJson||"[]"):[]};}
export function requireStaff(user,permission){
 if(!user?.staffActive)fail(403,"Administrator access required");
 if(user.role==="owner")return;
 const perms=JSON.parse(user.permissionsJson||"[]");
 if(permission==="courses.view"&&perms.some(p=>["courses.manage","lectures.manage","enrollments.manage"].includes(p)))return;
 if(!perms.includes(permission)&&!perms.includes("*"))fail(403,"Permission denied");
}
export async function isEnrolled(env,userId,courseId){
 const row=await env.DB.prepare(`SELECT
 EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=? AND e.course_id=?
        AND (e.expires_at IS NULL OR e.expires_at>unixepoch())) AS direct,
 EXISTS(SELECT 1 FROM course_inclusions i JOIN enrollments e ON e.course_id=i.parent_course_id
        WHERE i.child_course_id=? AND e.user_id=?
        AND (e.expires_at IS NULL OR e.expires_at>unixepoch())) AS bundled
 `).bind(userId,courseId,courseId,userId).first();
 return Boolean(row?.direct||row?.bundled);
}
export async function getLessonAccess(env,user,courseId,lectureId){
 const lesson=await env.DB.prepare(`SELECT l.*,c.published,c.price_inr,c.status,c.details_json FROM lectures l
 JOIN courses c ON c.id=l.course_id WHERE l.course_id=? AND l.id=?`).bind(courseId,lectureId).first();
 if(!lesson)fail(404,"Lesson not found");
 const admin=Boolean(user.staffActive&&(user.role==="owner"||JSON.parse(user.permissionsJson||"[]").includes("lectures.manage")));
 const paid=admin||await isEnrolled(env,user.id,courseId);
 const child=await env.DB.prepare(`SELECT 1 AS yes FROM course_inclusions i JOIN courses p ON p.id=i.parent_course_id WHERE i.child_course_id=? AND p.published=1 LIMIT 1`).bind(courseId).first();
 const folderOnly=Boolean(JSON.parse(lesson.details_json||"{}").folderOnly);
 const free=Boolean(lesson.published&&Number(lesson.price_inr)<=0&&lesson.free_preview);
 const trial=Boolean((lesson.published||folderOnly&&child)&&lesson.status!=="comingSoon"&&user.trialExpiresAt>Math.floor(Date.now()/1000)&&lesson.trial_enabled);
 if(!paid&&!admin&&!lesson.published&&!(folderOnly&&child&&trial))fail(404,"Lesson not available");
 if(!paid&&!admin&&lesson.status==="comingSoon")fail(403,"Course is not available yet");
 if(!paid&&!free&&!trial)fail(403,"This lesson requires an active enrollment");
 return lesson;
}
export function sanitizeCourseBody(d){
 const title=String(d.title||"").trim().slice(0,180);
 if(!title)fail(400,"Course title required");
 const price=Number(d.price||0);
 if(!Number.isFinite(price)||price<0||price>10000000)fail(400,"Invalid price");
 const status=["available","comingSoon"].includes(d.status)?d.status:"available";
 const base={
  title,description:String(d.description||"").slice(0,12000),track:String(d.track||"").slice(0,100),
  price,thumbnail:String(d.thumbnail||"").slice(0,2000),published:d.published?1:0,
  status,featured:d.featured?1:0,homeOrder:Number.isFinite(Number(d.homeOrder))?Number(d.homeOrder):999,
  details:{level:String(d.level||"").slice(0,80),language:String(d.language||"").slice(0,80),
  duration:String(d.duration||"").slice(0,80),instructor:String(d.instructor||"").slice(0,150),
  badge:String(d.badge||"").slice(0,80),plans:d.plans&&typeof d.plans==="object"?d.plans:{}}
 };
 const included=Array.isArray(d.includedCourseIds)?[...new Set(d.includedCourseIds.filter(x=>typeof x==="string"&&x.length<160))]:[];
 return {...base,included};
}
export function asTime(value){
 if(value==null)return null;
 if(typeof value==="number")return Number.isFinite(value)?Math.floor(value):null;
 if(typeof value==="string"){const n=Date.parse(value);return Number.isFinite(n)?Math.floor(n/1000):null;}
 return null;
}
