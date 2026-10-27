import {requireUser,requireStaff,checkOrigin,bodyJson,validateEmail,json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{const u=await requireUser(ctx);requireStaff(u,"staff.manage");
 const r=await ctx.env.DB.prepare(`SELECT s.user_id AS userId,u.email,s.role,s.permissions_json AS permissions,s.active
 FROM staff s JOIN users u ON u.id=s.user_id ORDER BY u.email`).all();return json({staff:(r.results||[]).map(s=>({...s,permissions:JSON.parse(s.permissions||"[]")}))})}
 catch(e){return errorResponse(e)}
}
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"staff.manage");
  if(u.role!=="owner")fail(403,"Only the owner can manage staff");
  const d=await bodyJson(ctx.request),email=validateEmail(d.email),permissions=Array.isArray(d.permissions)?d.permissions.filter(x=>["courses.view","courses.manage","lectures.manage","enrollments.manage"].includes(x)):[];
  const student=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
  if(!student)fail(404,"Ask this user to sign in before adding them as staff");
  const current=await ctx.env.DB.prepare("SELECT role FROM staff WHERE user_id=?").bind(student.id).first();
  if(current?.role==="owner")fail(403,"Owner permissions cannot be edited");
  await ctx.env.DB.prepare(`INSERT INTO staff(user_id,role,permissions_json,active) VALUES(?,'staff',?,?)
    ON CONFLICT(user_id) DO UPDATE SET permissions_json=excluded.permissions_json,active=excluded.active`).bind(student.id,JSON.stringify(permissions),d.active===false?0:1).run();
  return json({saved:true});
 }catch(e){return errorResponse(e)}
}
