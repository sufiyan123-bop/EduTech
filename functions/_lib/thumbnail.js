import {fail} from "./core.js";

// ImgBB share URLs show an HTML page, not an image. Convert only that
// known host to its OG image URL; never fetch arbitrary admin-supplied URLs.
export async function resolveThumbnailUrl(input){
 const value=String(input||"").trim();
 if(!value)return "";
 let url;
 try{url=new URL(value)}catch{fail(400,"Enter a valid thumbnail URL starting with https://");}
 if(url.protocol!=="https:"||url.username||url.password)fail(400,"Thumbnail URL must use HTTPS");
 const host=url.hostname.toLowerCase();
 if(host!=="ibb.co"&&host!=="www.ibb.co")return url.toString();

 const imageId=url.pathname.match(/^\/([A-Za-z0-9]+)\/?$/)?.[1];
 if(!imageId)fail(400,"Enter a valid ImgBB share URL or its Direct Link");
 let response;
 try{response=await fetch("https://ibb.co/"+imageId,{redirect:"error",headers:{Accept:"text/html"}});}
 catch{fail(400,"Cannot resolve ImgBB share link. Paste its Direct Link starting https://i.ibb.co/");}
 if(!response.ok)fail(400,"ImgBB share link could not be opened. Use the Direct Link from ImgBB.");
 const length=Number(response.headers.get("content-length")||0);
 if(length>250000)fail(400,"ImgBB page was too large. Use its Direct Link.");
 const html=(await response.text()).slice(0,250000);
 const meta=(html.match(/<meta\b[^>]*>/gi)||[]).find(tag=>/\bproperty\s*=\s*["']og:image["']/i.test(tag));
 const imageUrl=meta?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
 let direct;
 try{direct=new URL((imageUrl||"").replace(/&amp;/g,"&"))}catch{fail(400,"Could not find an image on that ImgBB page. Use its Direct Link.");}
 if(direct.protocol!=="https:"||direct.hostname.toLowerCase()!=="i.ibb.co"||
    !/^\/[a-z0-9_-]+\/[a-z0-9_.%-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(direct.pathname))
  fail(400,"ImgBB did not return a supported direct image URL");
 return direct.toString();
}
