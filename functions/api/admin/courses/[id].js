import {requireUser,requireStaff,checkOrigin,bodyJson,sanitizeCourseBody,json,fail,errorResponse} from "../../../_lib/core.js";
import {assertNoYoutubeWhenPaywalled} from "../../../_lib/video.js";
import {resolveThumbnailUrl} from "../../../_lib/thumbnail.js";
export async function onRequestPut(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);requireStaff(user,"courses.manage");
  const id=String(ctx.params.id||""),d=sanitizeCourseBody(await bodyJson(ctx.request,50000));
  d.thumbnail=await resolveThumbnailUrl(d.thumbnail);
  const old=await ctx.env.DB.prepare("SELECT id,details_json FROM courses WHERE id=?").bind(id).first();
  if(!old)fail(404,"Course not found");
  if(JSON.parse(old.details_json||"{}").folderOnly===true){
   // Preserve folder identity even if edited through the generic course API.
   d.details.folderOnly=true;d.published=0;d.price=0;d.featured=0;
   if(d.included.length)fail(409,"Private folders cannot include other courses");
  }
  if(d.included.includes(id))fail(400,"Course cannot include itself");
  if(d.included.length){
   const all=await ctx.env.DB.prepare("SELECT id FROM courses").all(),ids=new Set((all.results||[]).map(x=>x.id));
   if(d.included.some(x=>!ids.has(x)))fail(400,"An included course does not exist");
   const conflicts=await ctx.env.DB.prepare(`SELECT parent_course_id,child_course_id FROM course_inclusions
     WHERE parent_course_id<>? OR child_course_id=?`).bind(id,id).all();
   if((conflicts.results||[]).some(c=>d.included.includes(c.child_course_id)&&c.parent_course_id!==id))fail(409,"One of these courses already belongs to another bundle");
   if((conflicts.results||[]).some(c=>c.parent_course_id===id&&d.included.includes(c.child_course_id))){} 
   const nested=await ctx.env.DB.prepare("SELECT parent_course_id FROM course_inclusions WHERE child_course_id=?").bind(id).all();
   if((nested.results||[]).length)fail(409,"An included child course cannot become a master bundle");
   const childParents=await ctx.env.DB.prepare("SELECT parent_course_id FROM course_inclusions WHERE parent_course_id IN ("+d.included.map(()=>"?").join(",")+")").bind(...d.included).all();
   if((childParents.results||[]).length)fail(409,"Nested bundles are not supported");
  }
  await assertNoYoutubeWhenPaywalled(ctx.env,id,d.included,d.price);
  const statements=[
   ctx.env.DB.prepare(`UPDATE courses SET title=?,description=?,track=?,price_inr=?,thumbnail=?,published=?,status=?,featured=?,sort_order=?,details_json=?,updated_at=unixepoch() WHERE id=?`).bind(d.title,d.description,d.track,d.price,d.thumbnail,d.published,d.status,d.featured,d.homeOrder,JSON.stringify(d.details),id),
   ctx.env.DB.prepare("DELETE FROM course_inclusions WHERE parent_course_id=?").bind(id),
   ...d.included.map((child,i)=>ctx.env.DB.prepare("INSERT INTO course_inclusions(parent_course_id,child_course_id,sort_order) VALUES(?,?,?)").bind(id,child,i))
  ];await ctx.env.DB.batch(statements);
  return json({saved:true});
 }catch(e){return errorResponse(e)}
}
export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);const user=await requireUser(ctx);requireStaff(user,"courses.manage");
  const id=String(ctx.params.id||"");
  const dependencies=await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM enrollments WHERE course_id=?").bind(id).first();
  const child=await ctx.env.DB.prepare("SELECT details_json FROM courses WHERE id=?").bind(id).first();
  if(!child)fail(404,"Course not found");
  if(JSON.parse(child.details_json||"{}").folderOnly===true)
   fail(409,"Use the folder manager to remove an empty private folder");
  const included=await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM course_inclusions WHERE parent_course_id=?").bind(id).first();
  if(Number(included?.n||0)>0)fail(409,"Remove or detach included folders and courses before deleting the master course");

  if(dependencies?.n)fail(409,"Course has student enrollments. Unpublish it instead of deleting.");
  await ctx.env.DB.prepare("DELETE FROM courses WHERE id=?").bind(id).run();
  return json({deleted:true});
 }catch(e){return errorResponse(e)}
}
