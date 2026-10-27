import {json,errorResponse} from "../../_lib/core.js";
export async function onRequestGet({env}){
 try{
  if(!env.DB)return json({error:"Database is not configured"},503);
  const [courses,includes]=await Promise.all([
   env.DB.prepare(`SELECT c.id,c.title,c.description,c.track,c.price_inr AS price,c.thumbnail,
    c.published,c.status,c.featured,c.sort_order AS homeOrder,c.details_json
    FROM courses c WHERE c.published=1 AND NOT EXISTS(
      SELECT 1 FROM course_inclusions i WHERE i.child_course_id=c.id
    ) ORDER BY c.featured DESC,c.sort_order,c.title`).all(),
   env.DB.prepare(`SELECT i.parent_course_id AS parentId,c.id,c.title
    FROM course_inclusions i JOIN courses c ON c.id=i.child_course_id
    WHERE c.published=1 ORDER BY i.sort_order,c.title`).all()
  ]);
  return json({courses:(courses.results||[]).map(c=>({
   ...c,...JSON.parse(c.details_json||"{}"),featured:Boolean(c.featured),
   includedCourses:(includes.results||[]).filter(x=>x.parentId===c.id).map(x=>({id:x.id,title:x.title}))
  }))},200,{"Cache-Control":"public, max-age=60"});
 }catch(e){return errorResponse(e)}
}
