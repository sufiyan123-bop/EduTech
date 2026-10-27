import {requireUser,requireStaff,checkOrigin,bodyJson,json,fail,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{const u=await requireUser(ctx);requireStaff(u,"courses.view");
 const r=await ctx.env.DB.prepare("SELECT id,name FROM tracks ORDER BY name").all();return json({tracks:r.results||[]})}
 catch(e){return errorResponse(e)}
}
export async function onRequestPost(ctx){
 try{checkOrigin(ctx.request);const u=await requireUser(ctx);requireStaff(u,"courses.manage");
 const d=await bodyJson(ctx.request),name=String(d.name||"").trim().slice(0,100);
 if(!name)fail(400,"Category name required");
 await ctx.env.DB.prepare("INSERT OR IGNORE INTO tracks(id,name) VALUES(?,?)").bind(crypto.randomUUID(),name).run();
 return json({saved:true})}catch(e){return errorResponse(e)}
}
