import { createCredentials,issueSession,assertSameOrigin,noStore,respondError,validatePassword } from "../../_lib/security.js";
export async function onRequestPost({request,env}){
 try{
  assertSameOrigin(request);
  if(!env.DB)return noStore({error:"Database not configured"},503);
  const input=await request.json();
  const email=String(input.email||"").trim().toLowerCase(),name=String(input.name||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length<2||name.length>120||!validatePassword(input.password))
   return noStore({error:"Enter your name, valid email and password of at least 12 characters."},400);
  const id=crypto.randomUUID();
  try{
   await env.DB.prepare("INSERT INTO users(id,email,display_name,auth_provider) VALUES(?,?,?,'password')").bind(id,email,name).run();
  }catch(e){if(String(e).includes("UNIQUE"))return noStore({error:"Account already exists. Please sign in or reset your password."},409);throw e;}
  try{await createCredentials(env.DB,id,input.password);}
  catch(e){await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run().catch(()=>{});throw e;}
  const cookie=await issueSession(env.DB,request,id);
  return noStore({user:{id,email,displayName:name}},201,{"Set-Cookie":cookie});
 }catch(e){return respondError(e)}
}
