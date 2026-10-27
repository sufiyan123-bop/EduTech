import { verifyCredentials,issueSession,assertSameOrigin,noStore,respondError } from "../../_lib/security.js";
export async function onRequestPost({request,env}){
 try{
  assertSameOrigin(request);
  if(!env.DB)return noStore({error:"Database not configured"},503);
  const {email,password}=await request.json();
  const normalized=String(email||"").trim().toLowerCase();
  if(normalized.length>254||typeof password!=="string"||password.length>256)return noStore({error:"Invalid credentials"},401);
  const user=await env.DB.prepare("SELECT id,email,display_name AS displayName,auth_provider FROM users WHERE email=?").bind(normalized).first();
  if(!user||!await verifyCredentials(env.DB,user.id,password))
   return noStore({error:"Invalid credentials or account needs migration."},401);
  const cookie=await issueSession(env.DB,request,user.id);
  return noStore({user:{id:user.id,email:user.email,displayName:user.displayName}},200,{"Set-Cookie":cookie});
 }catch(e){return respondError(e)}
}
