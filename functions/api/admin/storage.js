import {requireUser,requireStaff,json,fail,errorResponse} from "../../_lib/core.js";
import {getR2StorageUsage} from "../../_lib/r2-quota.js";

export async function onRequestGet(ctx){
 try{
  const user=await requireUser(ctx);requireStaff(user,"lectures.manage");
  if(!ctx.env.VIDEOS)fail(503,"Private video storage is unavailable");
  const usage=await getR2StorageUsage(ctx.env.VIDEOS);
  return json({storage:usage});
 }catch(e){return errorResponse(e)}
}
