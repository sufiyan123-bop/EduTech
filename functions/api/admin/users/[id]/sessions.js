import {requireUser,checkOrigin,fail,json,errorResponse} from "../../../../_lib/core.js";
import {requireOwner} from "../index.js";

// A security action: sign a user out of every active session, without removing
// their courses, progress, verified identity or payments.
export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);
  const owner=await requireUser(ctx);requireOwner(owner);
  const id=String(ctx.params.id||"");
  if(!id||id.length>160)fail(400,"Invalid user ID");
  if(id===owner.id)fail(400,"You cannot revoke your own owner session here");
  const target=await ctx.env.DB.prepare(`SELECT u.id,st.role FROM users u
    LEFT JOIN staff st ON st.user_id=u.id WHERE u.id=?`).bind(id).first();
  if(!target)fail(404,"User not found");
  if(target.role==="owner")fail(403,"Owner sessions cannot be revoked");
  const result=await ctx.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  return json({revokedSessions:true,count:result.meta?.changes||0});
 }catch(e){return errorResponse(e)}
}
