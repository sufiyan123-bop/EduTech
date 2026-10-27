import {lectureAccess} from "../../../_lib/access.js";
import {respondError} from "../../../_lib/security.js";
// Private video streaming. Authenticate every request, including HTTP Range.
// Never put R2 keys or public bucket URLs into course catalog JSON.
export async function onRequestGet({env,request,params}){
 try{
 if(!env.VIDEOS) return Response.json({error:"Video storage not configured"},{status:503});
 const courseId=String(params.courseId||""),lectureId=String(params.lectureId||"");
 if(!/^[\w-]{1,150}$/.test(courseId)||!/^[\w-]{1,150}$/.test(lectureId))
  return Response.json({error:"Invalid lecture"},{status:400});
 const {lecture}=await lectureAccess(env,request,courseId,lectureId);
 if(!lecture.r2_object_key)return Response.json({error:"Video not uploaded"},{status:404});
 const rangeHeader=request.headers.get("Range");
 if(rangeHeader&&!/^bytes=\d*-\d*$/.test(rangeHeader))return new Response(null,{status:416});
 const object=await env.VIDEOS.get(lecture.r2_object_key,rangeHeader?{range:request.headers}:undefined);
 if(!object)return Response.json({error:"Video not found"},{status:404});
 const headers=new Headers({"Content-Type":object.httpMetadata?.contentType||"video/mp4","Cache-Control":"private, no-store","Accept-Ranges":"bytes","X-Content-Type-Options":"nosniff"});
 const size=object.size;
 if(object.range){
  const offset=object.range.offset||0,length=object.range.length||size;
  headers.set("Content-Range",`bytes ${offset}-${offset+length-1}/${size}`);
  headers.set("Content-Length",String(length));
  return new Response(object.body,{status:206,headers});
 }
 headers.set("Content-Length",String(size));
 return new Response(object.body,{status:200,headers});
 }catch(e){return respondError(e)}
}
