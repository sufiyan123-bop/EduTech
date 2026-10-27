import {json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  if(!ctx.env.DB)fail(503,"Database is not configured");
  const id=String(ctx.params.courseId||"");if(!id||id.length>160)fail(400,"Invalid course");
  const course=await ctx.env.DB.prepare(`SELECT id,title,description,track,price_inr AS price,
   thumbnail,status,featured,details_json FROM courses WHERE id=? AND published=1`).bind(id).first();
  if(!course)fail(404,"Course not found");
  const included=await ctx.env.DB.prepare(`SELECT c.id,c.title,c.description,c.thumbnail,c.track,c.price_inr AS price
   FROM course_inclusions i JOIN courses c ON c.id=i.child_course_id
   WHERE i.parent_course_id=? AND c.published=1 ORDER BY i.sort_order,c.title`).bind(id).all();
  const modules=await Promise.all([course,...(included.results||[])].map(async c=>{
   const catalog=await ctx.env.DB.prepare(`SELECT id,title,sort_order AS "order",trial_enabled AS trialEnabled,free_preview AS freePreview
    FROM lectures WHERE course_id=? ORDER BY sort_order,title`).bind(c.id).all();
   return {...c,lessons:(catalog.results||[]).map(l=>({...l,trialEnabled:Boolean(l.trialEnabled),freePreview:Boolean(l.freePreview)}))};
  }));
  const {details_json,...safe}=course;
  return json({course:{...safe,...JSON.parse(details_json||"{}")},modules},200,{"Cache-Control":"public, max-age=60"});
 }catch(e){return errorResponse(e)}
}
