import {requireUser,requireStaff,fail,json,errorResponse} from "../../../_lib/core.js";

// Owner or explicitly delegated student-management administrators only.
export function requireUserManager(user){requireStaff(user,"users.manage")}

// Delegates cannot view, edit, delete or revoke sessions for the owner or
// another active admin, even if the caller guesses an account ID.
export async function ensureManagedTarget(ctx,actor,id){
 const target=await ctx.env.DB.prepare(`SELECT u.id,u.email,
  COALESCE(s.role,'student') AS role,COALESCE(s.active,0) AS staffActive
  FROM users u LEFT JOIN staff s ON s.user_id=u.id
  WHERE u.id=? AND u.auth_provider <> 'deleted'`).bind(id).first();
 if(!target?.id)fail(404,"User not found");
 const protectedEmail=String(ctx.env.OWNER_EMAIL||"").trim().toLowerCase();
 if(actor.role!=="owner"&&
  (target.role==="owner"||target.staffActive===1||
    protectedEmail&&target.email.toLowerCase()===protectedEmail))
  fail(403,"Only the owner can manage owner or admin accounts");
 return target;
}

function userFilter(filter){
 if(filter==="enrolled")return "EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id=u.id AND (e.expires_at IS NULL OR e.expires_at>unixepoch()))";
 if(filter==="trial")return "u.trial_expires_at>unixepoch()";
 if(filter==="staff")return "EXISTS (SELECT 1 FROM staff s WHERE s.user_id=u.id AND s.active=1)";
 if(filter==="paid")return "EXISTS (SELECT 1 FROM payment_orders po WHERE po.user_id=u.id AND po.state='paid')";
 if(filter==="no-access")return "NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id=u.id AND (e.expires_at IS NULL OR e.expires_at>unixepoch()))";
 return "";
}
export async function onRequestGet(ctx){
 try{
  const current=await requireUser(ctx);requireUserManager(current);
  const params=new URL(ctx.request.url).searchParams;
  const search=String(params.get("q")||"").trim().slice(0,100);
  const filter=String(params.get("filter")||"all");
  const sort=String(params.get("sort")||"newest");
  const page=Math.min(100000,Math.max(1,Number.parseInt(params.get("page"),10)||1));
  const size=Math.min(50,Math.max(1,Number.parseInt(params.get("size"),10)||20));
  const conditions=["u.auth_provider <> 'deleted'"],args=[];
  if(current.role!=="owner"){
   conditions.push("NOT EXISTS (SELECT 1 FROM staff st2 WHERE st2.user_id=u.id AND (st2.role='owner' OR st2.active=1))");
   const designated=String(ctx.env.OWNER_EMAIL||"").trim();
   if(designated){conditions.push("u.email <> ? COLLATE NOCASE");args.push(designated)}
  }
  if(search){conditions.push("(instr(lower(u.email),lower(?))>0 OR instr(lower(u.display_name),lower(?))>0)");args.push(search,search)}
  const f=userFilter(filter);if(f)conditions.push(f);
  const where=conditions.length?" WHERE "+conditions.join(" AND "):"";
  const allowedOrders={
   newest:"u.created_at DESC,u.id DESC",
   oldest:"u.created_at ASC,u.id ASC",
   name:"u.display_name COLLATE NOCASE ASC,u.id ASC",
   email:"u.email COLLATE NOCASE ASC,u.id ASC"
  };
  const order=allowedOrders[sort]||allowedOrders.newest;
  const [count,list,summary]=await Promise.all([
   ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM users u"+where).bind(...args).first(),
   ctx.env.DB.prepare(`SELECT u.id,u.email,u.display_name AS displayName,u.auth_provider AS authProvider,
     u.created_at AS createdAt,u.trial_expires_at AS trialExpiresAt,
     COALESCE(st.role,'student') AS role,
     COALESCE(st.active,0) AS staffActive,
     (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id AND
       (e.expires_at IS NULL OR e.expires_at>unixepoch())) AS activeCourses,
     (SELECT COUNT(*) FROM payment_orders p WHERE p.user_id=u.id AND p.state='paid') AS paidOrders,
     (SELECT MAX(se.created_at) FROM sessions se WHERE se.user_id=u.id) AS lastSessionAt
     FROM users u LEFT JOIN staff st ON st.user_id=u.id
     ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size).all(),
   ctx.env.DB.prepare(`SELECT
     (SELECT COUNT(*) FROM users WHERE auth_provider <> 'deleted') AS total,
     (SELECT COUNT(*) FROM users WHERE auth_provider <> 'deleted' AND trial_expires_at>unixepoch()) AS activeTrials,
     (SELECT COUNT(DISTINCT e.user_id) FROM enrollments e JOIN users u2 ON u2.id=e.user_id
      WHERE u2.auth_provider <> 'deleted' AND (e.expires_at IS NULL OR e.expires_at>unixepoch())) AS activeLearners,
     (SELECT COUNT(*) FROM staff s JOIN users u2 ON u2.id=s.user_id
      WHERE s.active=1 AND u2.auth_provider <> 'deleted') AS teamMembers,
     (SELECT COUNT(DISTINCT p.user_id) FROM payment_orders p JOIN users u2 ON u2.id=p.user_id
      WHERE p.state='paid' AND u2.auth_provider <> 'deleted') AS payingLearners
   `).first()
  ]);
  return json({users:list.results||[],total:count?.n||0,page,size,summary},
    200,{"Cache-Control":"no-store"});
 }catch(e){return errorResponse(e)}
}
