import {requireUser,requireStaff,checkOrigin,bodyJson,json,fail,errorResponse} from "../../_lib/core.js";
import {assertYoutubeSafeForCourse} from "../../_lib/video.js";
const clean=d=>{
 const title=String(d.title||"").trim().slice(0,220);if(!title)fail(400,"Lecture title is required");
 const raw=String(d.youtubeId||"").trim(),r2=String(d.r2ObjectKey||"").trim();
 let youtube=raw;
 if(raw&&!/^[\w-]{11}$/.test(raw)){
  try{
   const url=new URL(raw),host=url.hostname.toLowerCase().replace(/^www\./,"");
   const valid=["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com","youtu.be"].includes(host)&&url.protocol==="https:";
   if(!valid)throw Error("Invalid YouTube host");
   youtube=host==="youtu.be"?url.pathname.split("/")[1]:(url.searchParams.get("v")||url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]||"");
  }catch{fail(400,"Enter a valid YouTube video link or ID")}
 }
 if(youtube&&!/^[\w-]{11}$/.test(youtube))fail(400,"Enter a valid YouTube video link or ID");
 if(r2&&(!r2.startsWith("lessons/")||r2.includes("..")||r2.length>500))fail(400,"Invalid private video key");
 return {title,youtube,r2,chapter:String(d.chapter||"General").trim().slice(0,160)||"General",order:Number.isFinite(Number(d.order))?Number(d.order):0,trial:d.trialEnabled?1:0,preview:d.freePreview?1:0};
};
export async function onRequestGet(ctx){
 try{
  const u=await requireUser(ctx);requireStaff(u,"lectures.manage");
  const courseId=String(new URL(ctx.request.url).searchParams.get("courseId")||"");
  const r=await ctx.env.DB.prepare("SELECT id,course_id AS courseId,title,chapter,sort_order AS 'order',trial_enabled AS trialEnabled,free_preview AS freePreview,youtube_id AS youtubeId,r2_object_key AS r2ObjectKey FROM lectures WHERE course_id=? ORDER BY sort_order,title").bind(courseId).all();
  return json({lectures:r.results||[]});
 }catch(e){return errorResponse(e)}
}
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"lectures.manage");
  const body=await bodyJson(ctx.request);const courseId=String(body.courseId||""),d=clean(body);
  const course=await ctx.env.DB.prepare("SELECT id,price_inr FROM courses WHERE id=?").bind(courseId).first();if(!course)fail(404,"Course not found");
  await assertYoutubeSafeForCourse(ctx.env,courseId,d.youtube,course.price_inr);
  const id=crypto.randomUUID();
  await ctx.env.DB.prepare(`INSERT INTO lectures(id,course_id,title,chapter,sort_order,trial_enabled,free_preview,youtube_id,r2_object_key)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,courseId,d.title,d.chapter,d.order,d.trial,d.preview,d.youtube||null,d.r2||null).run();
  return json({id},201);
 }catch(e){return errorResponse(e)}
}
export async function onRequestPut(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"lectures.manage");
  const body=await bodyJson(ctx.request),id=String(body.id||""),courseId=String(body.courseId||""),d=clean(body);
  const course=await ctx.env.DB.prepare("SELECT id,price_inr FROM courses WHERE id=?").bind(courseId).first();
  if(!course)fail(404,"Course not found");
  await assertYoutubeSafeForCourse(ctx.env,courseId,d.youtube,course.price_inr);
  const result=await ctx.env.DB.prepare(`UPDATE lectures SET title=?,chapter=?,sort_order=?,trial_enabled=?,free_preview=?,youtube_id=?,r2_object_key=?
    WHERE id=? AND course_id=?`).bind(d.title,d.chapter,d.order,d.trial,d.preview,d.youtube||null,d.r2||null,id,courseId).run();
  if(!result.meta?.changes)fail(404,"Lecture not found");return json({saved:true});
 }catch(e){return errorResponse(e)}
}
export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"lectures.manage");
  const body=await bodyJson(ctx.request);
  await ctx.env.DB.prepare("DELETE FROM lectures WHERE id=? AND course_id=?").bind(String(body.id||""),String(body.courseId||"")).run();
  return json({deleted:true});
 }catch(e){return errorResponse(e)}
}
