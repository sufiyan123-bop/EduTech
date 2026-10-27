import {requireUser,requireStaff,checkOrigin,bodyJson,sanitizeCourseBody,json,fail,errorResponse} from "../../_lib/core.js";
function present(c){const d=JSON.parse(c.details_json||"{}");return {
 id:c.id,title:c.title,description:c.description,track:c.track,price:c.price_inr,
 thumbnail:c.thumbnail,published:Boolean(c.published),status:c.status,featured:Boolean(c.featured),
 homeOrder:c.sort_order,...d,includedCourseIds:c.includedCourseIds||[]
}}
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);requireStaff(user,"courses.view");
  const [a,b]=await Promise.all([
   ctx.env.DB.prepare("SELECT * FROM courses ORDER BY sort_order ASC,title ASC").all(),
   ctx.env.DB.prepare("SELECT parent_course_id,child_course_id FROM course_inclusions ORDER BY sort_order").all()
  ]);
  return json({courses:(a.results||[]).map(c=>present({...c,includedCourseIds:(b.results||[]).filter(i=>i.parent_course_id===c.id).map(i=>i.child_course_id)}))});
 }catch(e){return errorResponse(e)}
}
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);requireStaff(user,"courses.manage");
  const d=sanitizeCourseBody(await bodyJson(ctx.request,50000));
  const id=crypto.randomUUID();if(d.included.length)fail(400,"Create the main course first, then add included courses");
  await ctx.env.DB.prepare(`INSERT INTO courses(id,title,description,track,price_inr,thumbnail,published,status,featured,sort_order,details_json)
   VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,d.title,d.description,d.track,d.price,d.thumbnail,d.published,d.status,d.featured,d.homeOrder,JSON.stringify(d.details)).run();
  return json({id},201);
 }catch(e){return errorResponse(e)}
}
