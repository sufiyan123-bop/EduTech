import {checkOrigin,sha256,sessionCookie,json,errorResponse} from "../../_lib/core.js";
export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const cookie=ctx.request.headers.get("cookie")||"",token=cookie.match(/(?:^|;\s*)edutech_session=([0-9a-f]{64})(?:;|$)/)?.[1];
  if(token&&ctx.env.DB)await ctx.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return json({signedOut:true},200,{"Set-Cookie":sessionCookie(ctx.request,"",0)});
 }catch(e){return errorResponse(e)}
}
