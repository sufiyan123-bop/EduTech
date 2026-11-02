import {fail} from "./core.js";

// Decimal GB, matching the Cloudflare storage dashboard. 9.3 GB is a
// safety ceiling; stop new uploads at 9.0 GB to leave 300 MB headroom.
export const R2_UPLOAD_TARGET_BYTES=9_000_000_000;
export const R2_ABSOLUTE_MAX_BYTES=9_300_000_000;

export async function getR2StorageUsage(bucket){
 if(!bucket||typeof bucket.list!=="function")
  fail(503,"Storage usage cannot be verified. Upload blocked to protect the 9 GB limit.");
 let cursor,usedBytes=0,objects=0;
 const cursors=new Set();
 do{
  const page=await bucket.list({limit:1000,...(cursor?{cursor}:{})});
  if(!page||!Array.isArray(page.objects))
   fail(503,"Storage usage could not be verified. No upload was started.");
  for(const item of page.objects){
   const size=Number(item.size);
   if(!Number.isSafeInteger(size)||size<0)
    fail(503,"Storage size metadata is invalid. No upload was started.");
   usedBytes+=size;objects++;
   if(!Number.isSafeInteger(usedBytes))
    fail(503,"Storage usage is too large to verify safely.");
  }
  if(!page.truncated)break;
  if(!page.cursor||cursors.has(page.cursor))
   fail(503,"Could not finish checking all R2 files. Upload blocked.");
  cursor=page.cursor;
  cursors.add(cursor);
 }while(true);
 return {usedBytes,objects,remainingBytes:Math.max(0,R2_UPLOAD_TARGET_BYTES-usedBytes),
  targetBytes:R2_UPLOAD_TARGET_BYTES,absoluteMaxBytes:R2_ABSOLUTE_MAX_BYTES};
}

export async function requireR2Capacity(bucket,incomingBytes){
 if(!Number.isSafeInteger(incomingBytes)||incomingBytes<0)
  fail(400,"Invalid upload size");
 const usage=await getR2StorageUsage(bucket);
 if(usage.usedBytes+incomingBytes>R2_UPLOAD_TARGET_BYTES)
  fail(413,"R2 storage is near its 9 GB limit. This upload was blocked. Free some space or choose smaller videos.");
 return usage;
}
