export async function onRequestGet(ctx){
 const id=String(ctx.params.id||"");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  return new Response("Not found",{status:404});
 if(!ctx.env.VIDEOS)return new Response("Storage unavailable",{status:503});
 const object=await ctx.env.VIDEOS.get("thumbnails/"+id);
 if(!object)return new Response("Not found",{status:404});
 const type=object.httpMetadata?.contentType||"";
 if(!["image/png","image/jpeg","image/webp"].includes(type))return new Response("Not found",{status:404});
 return new Response(object.body,{
  headers:{
   "Content-Type":type,
   "Cache-Control":"public, max-age=31536000, immutable",
   "X-Content-Type-Options":"nosniff",
   "Cross-Origin-Resource-Policy":"same-origin",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }
 });
}
