import {requireUser,requireStaff,checkOrigin,fail,json,errorResponse} from "../../_lib/core.js";
export const MAX_THUMBNAIL_BYTES=3*1024*1024;
export function validImageBytes(bytes,type){
 if(type==="image/png")return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 if(type==="image/jpeg")return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==="image/webp")return bytes.length>=12&&"RIFF"===String.fromCharCode(...bytes.slice(0,4))&&"WEBP"===String.fromCharCode(...bytes.slice(8,12));
 return false;
}
export async function onRequestPut(ctx){
 try{
  checkOrigin(ctx.request);
  const user=await requireUser(ctx);requireStaff(user,"courses.manage");
  if(!ctx.env.VIDEOS)fail(503,"Thumbnail storage is not configured");
  const type=String(ctx.request.headers.get("Content-Type")||"").toLowerCase().split(";")[0].trim();
  if(!["image/jpeg","image/png","image/webp"].includes(type))fail(415,"Use JPG, PNG or WebP for the course thumbnail");
  const size=Number(ctx.request.headers.get("Content-Length")||0);
  if(size>MAX_THUMBNAIL_BYTES)fail(413,"Thumbnail must be smaller than 3 MB");
  const buffer=await ctx.request.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  if(!bytes.length||bytes.length>MAX_THUMBNAIL_BYTES)fail(413,"Thumbnail must be smaller than 3 MB");
  if(!validImageBytes(bytes,type))fail(415,"The uploaded file is not a valid JPG, PNG or WebP image");
  const id=crypto.randomUUID();
  await ctx.env.VIDEOS.put("thumbnails/"+id,buffer,{httpMetadata:{contentType:type}});
  return json({url:new URL("/api/thumbnails/"+id,ctx.request.url).toString()});
 }catch(e){return errorResponse(e)}
}
