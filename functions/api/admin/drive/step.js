import {requireR2Capacity} from "../../../_lib/r2-quota.js";
import {requireUser,requireStaff,checkOrigin,bodyJson,json,fail,errorResponse} from "../../../_lib/core.js";
import {driveToken,driveFile,downloadRange,PART_SIZE} from "../../../_lib/drive-import.js";

function status(item,extra={}){
 return {id:item.id,state:item.state,nextPart:item.next_part,
  totalParts:Math.ceil(Number(item.size_bytes)/PART_SIZE),error:item.last_error||null,...extra};
}
async function getItem(db,id){
 return db.prepare(`SELECT i.*,j.drive_folder_id AS folderId FROM drive_import_items i
  JOIN drive_import_jobs j ON j.id=i.job_id WHERE i.id=?`).bind(id).first();
}
export async function onRequestPost(ctx){
 let leased=null,leaseToken=null,db=null;
 try{
  checkOrigin(ctx.request);
  const actor=await requireUser(ctx);requireStaff(actor,"lectures.manage");
  if(!ctx.env.DB||!ctx.env.VIDEOS)fail(503,"Private R2 video storage or D1 unavailable");
  db=ctx.env.DB;
  const body=await bodyJson(ctx.request);
  const itemId=String(body.itemId||"");
  if(!/^[a-f0-9-]{36}$/i.test(itemId))fail(400,"Invalid import item");
  let item=await getItem(db,itemId);
  if(!item)fail(404,"Import item not found");
  if(item.state==="completed")return json(status(item));
  // A short-lived DB lease stops two browsers from uploading the same part
  // simultaneously. The browser may retry safely after a failed step.
  leaseToken=crypto.randomUUID();
  const lock=await db.prepare(`UPDATE drive_import_items
   SET lease_token=?,lease_expires_at=unixepoch()+180
   WHERE id=? AND state<>'completed' AND
    (lease_token IS NULL OR lease_expires_at<unixepoch())`).bind(leaseToken,itemId).run();
  if(!lock.meta?.changes)fail(409,"Another import step is still running. Retry shortly.");
  leased=itemId;
  item=await getItem(db,itemId);
  const bucket=ctx.env.VIDEOS,partsTotal=Math.ceil(Number(item.size_bytes)/PART_SIZE);
  if(body.reset===true){
   if(item.upload_id){
    try{await bucket.resumeMultipartUpload(item.r2_key,item.upload_id).abort()}catch{}
   }
   const existing=await bucket.head(item.r2_key);
   if(existing)fail(409,"R2 video is already complete; resume instead of resetting");
   await db.prepare(`UPDATE drive_import_items SET state='pending',upload_id=NULL,parts_json='[]',
     next_part=1,last_error=NULL WHERE id=?`).bind(itemId).run();
   return json({id:itemId,state:"pending",nextPart:1,totalParts:partsTotal,reset:true});
  }
  if(item.state==="pending"){
   const token=driveToken(ctx.request),source=await driveFile(token,item.drive_file_id);
   if(!source.parents?.includes(item.folderId)||source.trashed||source.mimeType!==item.mime_type||
    Number(source.size)!==Number(item.size_bytes))
    fail(409,"Drive video changed or moved. Cancel this job and prepare it again.");
   // Confirm storage headroom before allocating multipart upload state.
   await requireR2Capacity(bucket,Number(item.size_bytes));
   // An object is only made visible as a lesson after multipart completion.
   const upload=await bucket.createMultipartUpload(item.r2_key,{httpMetadata:{contentType:item.mime_type}});
   await db.prepare(`UPDATE drive_import_items SET state='uploading',upload_id=?,last_error=NULL
     WHERE id=?`).bind(upload.uploadId,itemId).run();
   return json(status({...item,state:"uploading",next_part:1},{started:true}));
  }
  if(item.state==="uploading"){
   const currentPart=Number(item.next_part);
   if(!Number.isInteger(currentPart)||currentPart<1||currentPart>partsTotal+1)
    fail(409,"Invalid saved import state");
   if(currentPart<=partsTotal){
    const token=driveToken(ctx.request);
    const start=(currentPart-1)*PART_SIZE,
     end=Math.min(Number(item.size_bytes)-1,start+PART_SIZE-1);
    // One small byte range per request, never transfer a complete giant MP4
    // through the assistant or the student's browser.
    const bytes=await downloadRange(token,item.drive_file_id,start,end,Number(item.size_bytes));
    const upload=bucket.resumeMultipartUpload(item.r2_key,item.upload_id);
    const response=await upload.uploadPart(currentPart,bytes);
    const parts=JSON.parse(item.parts_json||"[]");
    const descriptor={partNumber:currentPart,etag:response.etag};
    const next=parts.filter(p=>p.partNumber!==currentPart).concat(descriptor)
     .sort((a,b)=>a.partNumber-b.partNumber);
    await db.prepare(`UPDATE drive_import_items SET parts_json=?,next_part=?,state=?,last_error=NULL
      WHERE id=?`).bind(JSON.stringify(next),currentPart+1,
       currentPart===partsTotal?"finalizing":"uploading",itemId).run();
    return json(status({...item,state:currentPart===partsTotal?"finalizing":"uploading",next_part:currentPart+1},
     {partsUploaded:currentPart}));
   }
   await db.prepare("UPDATE drive_import_items SET state='finalizing' WHERE id=?").bind(itemId).run();
   item={...item,state:"finalizing"};
  }
  if(item.state==="finalizing"){
   let object=await bucket.head(item.r2_key);
   if(!object){
    // Check again before completing. Other admins might have uploaded in the meantime.
    await requireR2Capacity(bucket,Number(item.size_bytes));
    const parts=JSON.parse(item.parts_json||"[]");
    if(parts.length!==partsTotal||parts.some((p,i)=>p.partNumber!==i+1||!p.etag))
     fail(409,"Import parts are incomplete. Resume the upload.");
    object=await bucket.resumeMultipartUpload(item.r2_key,item.upload_id).complete(parts);
   }
   if(Number(object.size)!==Number(item.size_bytes))
    fail(502,"R2 video size does not match Google Drive");
   // Fixed lecture ID and batch: a retried finalize cannot create duplicates.
   await db.batch([
    db.prepare(`INSERT OR IGNORE INTO lectures
     (id,course_id,title,chapter,sort_order,trial_enabled,free_preview,youtube_id,r2_object_key)
     VALUES(?,?,?,?,?,0,0,NULL,?)`)
     .bind(item.lecture_id,item.course_id,item.title,item.chapter,item.sort_order,item.r2_key),
    db.prepare(`UPDATE drive_import_items SET state='completed',completed_at=unixepoch(),
     last_error=NULL WHERE id=?`).bind(itemId)
   ]);
   return json(status({...item,state:"completed"},{lectureId:item.lecture_id}));
  }
  fail(409,"Unrecognized import status");
 }catch(e){
  if(leased&&db){
   const safe=e?.status&&e?.message?String(e.message).slice(0,240):"Transfer failed. Retry this step.";
   try{await db.prepare("UPDATE drive_import_items SET last_error=? WHERE id=? AND state<>'completed'")
    .bind(safe,leased).run()}catch{}
  }
  return errorResponse(e);
 }finally{
  if(leased&&db&&leaseToken){
   try{await db.prepare(`UPDATE drive_import_items SET lease_token=NULL,lease_expires_at=NULL
    WHERE id=? AND lease_token=?`).bind(leased,leaseToken).run()}catch{}
  }
 }
}
