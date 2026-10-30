import {requireUser,isEnrolled,json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx),db=ctx.env.DB,id=String(ctx.params.courseId||"");
  const root=await db.prepare("SELECT id,title,description,thumbnail,track,published,status FROM courses WHERE id=?").bind(id).first();
  if(!root)fail(404,"Course not found");
  if(!root.published&&!await isEnrolled(ctx.env,user.id,id))fail(404,"Course not found");
  const children=await db.prepare(`SELECT c.id,c.title,c.description,c.thumbnail,c.track,c.published
   FROM course_inclusions i JOIN courses c ON c.id=i.child_course_id
   WHERE i.parent_course_id=? ORDER BY i.sort_order,c.title`).bind(id).all();
  const modules=[root,...(children.results||[])];
  const assembled=await Promise.all(modules.map(async c=>{
   const [progress,paid]=await Promise.all([
    db.prepare(`SELECT l.id,l.title,l.chapter,l.sort_order AS "order",l.trial_enabled AS trialEnabled,
      l.free_preview AS freePreview, IFNULL(p.completed,0) AS completed,c.price_inr AS price,c.published,c.status,c.details_json
      FROM lectures l JOIN courses c ON c.id=l.course_id
      LEFT JOIN lesson_progress p ON p.user_id=? AND p.course_id=l.course_id AND p.lecture_id=l.id
      WHERE l.course_id=? ORDER BY l.sort_order,l.title`).bind(user.id,c.id).all(),
    isEnrolled(ctx.env,user.id,c.id)
   ]);
   const admin=Boolean(user.staffActive&&(user.role==="owner"||JSON.parse(user.permissionsJson||"[]").includes("lectures.manage")));
   return {...c,lessons:(progress.results||[]).map(l=>{
    const folderOnly=Boolean(JSON.parse(l.details_json||"{}").folderOnly);
    const free=Boolean(l.published&&Number(l.price)<=0&&l.freePreview);
    const trial=Boolean(l.trialEnabled&&l.status!=="comingSoon"&&(l.published||folderOnly&&c.id!==id&&root.published&&root.status!=="comingSoon"));
    return {id:l.id,title:l.title,chapter:l.chapter||"General",order:l.order,trialEnabled:Boolean(l.trialEnabled),
     completed:Boolean(l.completed),locked:!(admin||paid||free||trial)};
   }),unlocked:admin||paid};
  }));
  const total=assembled.reduce((n,c)=>n+c.lessons.length,0),done=assembled.reduce((n,c)=>n+c.lessons.filter(l=>l.completed).length,0);
  return json({course:root,modules:assembled,progress:{total,done,percent:total?Math.round(done/total*100):0}});
 }catch(e){return errorResponse(e)}
}
