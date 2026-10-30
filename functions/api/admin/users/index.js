import {requireUser,fail,json,errorResponse} from "../../_lib/core.js";

// Only the active academy owner may list personal student information.
export function requireOwner(user){
 if(user?.role!=="owner"||user.staffActive!==1)fail(403,"Only the academy owner can manage users");
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
  const current=await requireUser(ctx);requireOwner(current);
  const params=new URL(ctx.request.url).searchParams;
  const search=String(params.get("q")||"").trim().slice(0,100);
  const filter=String(params.get("filter")||"all");
  const sort=String(params.get("sort")||"newest");
  const page=Math.min(100000,Math.max(1,Number.parseInt(params.get("page"),10)||1));
  const size=Math.min(50,Math.max(1,Number.parseInt(params.get("size"),10)||20));
  const conditions=[],args=[];
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
     (SELECT COUNT(*) FROM users) AS total,
     (SELECT COUNT(*) FROM users WHERE trial_expires_at>unixepoch()) AS activeTrials,
     (SELECT COUNT(DISTINCT user_id) FROM enrollments WHERE expires_at IS NULL OR expires_at>unixepoch()) AS activeLearners,
     (SELECT COUNT(*) FROM staff WHERE active=1) AS teamMembers,
     (SELECT COUNT(DISTINCT user_id) FROM payment_orders WHERE state='paid') AS payingLearners
   `).first()
  ]);
  return json({users:list.results||[],total:count?.n||0,page,size,summary},
    200,{"Cache-Control":"no-store"});
 }catch(e){return errorResponse(e)}
}
