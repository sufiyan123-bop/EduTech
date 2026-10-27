import {requireUser,requireStaff,json,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{const u=await requireUser(ctx);requireStaff(u,"courses.view");
  const r=await ctx.env.DB.prepare(`SELECT
   (SELECT COUNT(*) FROM courses) AS courses,
   (SELECT COUNT(*) FROM lectures) AS lectures,
   (SELECT COUNT(*) FROM users) AS students,
   (SELECT COUNT(*) FROM enrollments WHERE expires_at IS NULL OR expires_at>unixepoch()) AS activeEnrollments
  `).first();
  return json({stats:r});
 }catch(e){return errorResponse(e)}
}
