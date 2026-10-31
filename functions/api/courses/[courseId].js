import {json,fail,errorResponse,optionalUser,requireStaff,isEnrolled} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  if(!ctx.env.DB)fail(503,"Database is not configured");
  const id=String(ctx.params.courseId||"");if(!id||id.length>160)fail(400,"Invalid course");
  const course=await ctx.env.DB.prepare(`SELECT id,title,description,track,price_inr AS price,
   thumbnail,status,featured,published,details_json FROM courses WHERE id=?`).bind(id).first();
  // Unpublished courses are private drafts, but admins can inspect their syllabus
  // without publishing them. Students (including paying users) see a 404.
  if(!course||JSON.parse(course.details_json||"{}").folderOnly===true)fail(404,"Course not found");
  const draft=!Boolean(course.published);
  if(draft){
   const viewer=await optionalUser(ctx);
   if(!viewer)fail(404,"Course not found");
   try{requireStaff(viewer,"courses.view")}catch{fail(404,"Course not found")}
  }
  // Never query or send lecture titles, IDs, lesson totals or trial flags for
  // non-buyers. Only an active course enrollment or authorized admin can see
  // the detailed syllabus. Master purchases already grant child entitlement.
  const viewer=await optionalUser(ctx);
  let admin=false;
  if(viewer){
   try{requireStaff(viewer,"courses.view");admin=true}catch{}
  }
  const canSeeLessons=Boolean(admin||(viewer&&await isEnrolled(ctx.env,viewer.id,id)));
  const included=await ctx.env.DB.prepare(`SELECT c.id,c.title,c.description,c.thumbnail,c.track,c.price_inr AS price
   FROM course_inclusions i JOIN courses c ON c.id=i.child_course_id
   WHERE i.parent_course_id=? ORDER BY i.sort_order,c.title`).bind(id).all();
  const modules=await Promise.all([course,...(included.results||[])].map(async c=>{
   if(!canSeeLessons)return {id:c.id,title:c.title,lessons:[]};
   const catalog=await ctx.env.DB.prepare(`SELECT id,title,chapter,sort_order AS "order",trial_enabled AS trialEnabled,free_preview AS freePreview
    FROM lectures WHERE course_id=? ORDER BY sort_order,title`).bind(c.id).all();
   return {...c,lessons:(catalog.results||[]).map(l=>({...l,trialEnabled:Boolean(l.trialEnabled),freePreview:Boolean(l.freePreview)}))};
  }));
  const {details_json,...safe}=course;
  return json({course:{...safe,...JSON.parse(details_json||"{}"),published:!draft},
   modules,previewOnly:!canSeeLessons},200,
   {"Cache-Control":viewer?"private, no-store":"public, max-age=60"});
 }catch(e){return errorResponse(e)}
}
