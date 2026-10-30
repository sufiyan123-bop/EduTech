import {requireUser,checkOrigin,bodyJson,validateEmail,json,fail,errorResponse} from "../../_lib/core.js";

// Only the owner can assign or remove administrative privileges. The delegated
// "staff" role never receives owner privileges or permission to manage staff.
export const STAFF_PERMISSIONS=Object.freeze([
 "courses.view","courses.manage","lectures.manage","enrollments.manage","users.manage"
]);

function requireOwner(user){
 if(user?.role!=="owner"||user.staffActive!==1)
  fail(403,"Only the academy owner can manage admin access");
}
function parsePermissions(value){
 if(!Array.isArray(value)||value.length<1||value.length>STAFF_PERMISSIONS.length||
  value.some(p=>typeof p!=="string"||!STAFF_PERMISSIONS.includes(p))||
  new Set(value).size!==value.length)
  fail(400,"Choose one or more valid admin permissions");
 return value;
}
function ownerEmail(env){return String(env.OWNER_EMAIL||"").trim().toLowerCase();}
function assertNotOwner(current,target,env){
 if(target.id===current.id||target.role==="owner"||target.email.toLowerCase()===ownerEmail(env))
  fail(403,"The academy owner account cannot be changed");
}

export async function onRequestGet(ctx){
 try{
  const owner=await requireUser(ctx);requireOwner(owner);
  const rows=await ctx.env.DB.prepare(`SELECT s.user_id AS userId,u.email,u.display_name AS displayName,
    u.auth_provider AS authProvider,s.role,s.permissions_json AS permissions,s.active
    FROM staff s JOIN users u ON u.id=s.user_id ORDER BY s.role='owner' DESC,u.email`).all();
  return json({staff:(rows.results||[]).map(s=>({
   ...s,permissions:JSON.parse(s.permissions||"[]")
  }))});
 }catch(e){return errorResponse(e)}
}

export async function onRequestPost(ctx){
 try{
  checkOrigin(ctx.request);
  const owner=await requireUser(ctx);requireOwner(owner);
  const d=await bodyJson(ctx.request);
  if(Object.keys(d).some(k=>!["email","permissions"].includes(k)))
   fail(400,"Only email and permissions may be changed");
  const email=validateEmail(d.email),permissions=parsePermissions(d.permissions);
  if(email===owner.email.toLowerCase()||email===ownerEmail(ctx.env))
   fail(403,"The academy owner account cannot be changed");
  let target=await ctx.env.DB.prepare(`SELECT u.id,u.email,u.auth_provider,s.role
    FROM users u LEFT JOIN staff s ON s.user_id=u.id WHERE u.email=? COLLATE NOCASE`).bind(email).first();
  if(!target){
   // A pending admin can sign in later, but only email OTP or verified Google
   // identity proves ownership of this address. No account is logged in here.
   await ctx.env.DB.prepare(`INSERT INTO users(id,email,display_name,auth_provider)
    VALUES(?,?,?,'pending_otp') ON CONFLICT(email) DO NOTHING`)
    .bind(crypto.randomUUID(),email,email.split("@")[0]).run();
   target=await ctx.env.DB.prepare(`SELECT u.id,u.email,u.auth_provider,s.role
    FROM users u LEFT JOIN staff s ON s.user_id=u.id WHERE u.email=? COLLATE NOCASE`).bind(email).first();
  }
  if(!target||target.auth_provider==="deleted")fail(409,"Cannot assign access to a deleted account");
  assertNotOwner(owner,target,ctx.env);
  const saved=await ctx.env.DB.prepare(`INSERT INTO staff(user_id,role,permissions_json,active)
     VALUES(?,'staff',?,1)
     ON CONFLICT(user_id) DO UPDATE SET role='staff',permissions_json=excluded.permissions_json,active=1
     WHERE staff.role<>'owner'`).bind(target.id,JSON.stringify(permissions)).run();
  if(!saved.meta?.changes)fail(403,"Owner permissions cannot be changed");
  return json({saved:true,userId:target.id,pendingSignIn:target.auth_provider==="pending_otp"});
 }catch(e){return errorResponse(e)}
}

export async function onRequestDelete(ctx){
 try{
  checkOrigin(ctx.request);
  const owner=await requireUser(ctx);requireOwner(owner);
  const d=await bodyJson(ctx.request);
  if(Object.keys(d).length!==1||typeof d.userId!=="string"||!d.userId||d.userId.length>160)
   fail(400,"Enter a valid team member ID");
  const target=await ctx.env.DB.prepare(`SELECT u.id,u.email,s.role,s.active
    FROM staff s JOIN users u ON u.id=s.user_id WHERE s.user_id=?`).bind(d.userId).first();
  if(!target)fail(404,"Team member not found");
  assertNotOwner(owner,target,ctx.env);
  // Keep the student profile, enrollment, payments and progress intact.
  // Every API request rechecks staff against D1; removal takes effect at once.
  const result=await ctx.env.DB.prepare("DELETE FROM staff WHERE user_id=? AND role='staff'").bind(d.userId).run();
  if(!result.meta?.changes)fail(403,"Owner permissions cannot be changed");
  return json({removed:true,userId:d.userId});
 }catch(e){return errorResponse(e)}
}
