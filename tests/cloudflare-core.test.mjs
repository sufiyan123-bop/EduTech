import test from "node:test";
import assert from "node:assert/strict";
import {hmacHex,verifyHmac,sanitizeCourseBody,getLessonAccess} from "../functions/_lib/core.js";
import {calendarMonths,paymentConfigured} from "../functions/_lib/payments.js";
test("Cloudflare OTP HMAC rejects changed email or code",async()=>{
 const sig=await hmacHex("long-example-test-secret","student@example.com:123456");
 assert.equal(await verifyHmac("long-example-test-secret","student@example.com:123456",sig),true);
 assert.equal(await verifyHmac("long-example-test-secret","student@example.com:111111",sig),false);
 assert.equal(await verifyHmac("long-example-test-secret","other@example.com:123456",sig),false);
 assert.equal(await verifyHmac("long-example-test-secret","student@example.com:123456","bad"),false);
});
test("Course sanitizer removes duplicate included IDs and rejects invalid pricing",()=>{
 const c=sanitizeCourseBody({title:"AiOps",price:"2000",includedCourseIds:["linux","python","linux"]});
 assert.deepEqual(c.included,["linux","python"]);
 assert.throws(()=>sanitizeCourseBody({title:"",price:10}),/title/);
 assert.throws(()=>sanitizeCourseBody({title:"AiOps",price:-1}),/price/);
});
test("Payment configuration requires explicit safe mode and enable switch",()=>{
 const env={RAZORPAY_KEY_ID:"rzp_test_sample123",RAZORPAY_KEY_SECRET:"secret",RAZORPAY_WEBHOOK_SECRET:"hook"};
 assert.equal(paymentConfigured(env),false);
 assert.equal(paymentConfigured({...env,PAYMENTS_ENABLED:"true"}),false);
 assert.equal(paymentConfigured({...env,PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"owner_test"}),true);
 assert.equal(paymentConfigured({...env,PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"live"}),false);
 assert.equal(paymentConfigured({...env,PAYMENTS_ENABLED:"true",PAYMENTS_MODE:"owner_test",RAZORPAY_KEY_ID:"rzp_live_real123"}),false);
});
test("Calendar-month renewals handle February",()=>{
 assert.equal(new Date(calendarMonths(Date.parse("2024-01-31T08:00:00Z"),1)*1000).toISOString(),"2024-02-29T08:00:00.000Z");
});
function context(lesson,{enrolled=false,included=false}={}){
 return {DB:{prepare:(sql)=>({
  bind:()=>({first:async()=>{
   if(sql.includes("SELECT l.*"))return lesson;
   if(sql.includes("FROM enrollments e"))return {direct:enrolled?1:0,bundled:0};
   if(sql.includes("FROM course_inclusions i JOIN courses p"))return included?{yes:1}:null;
   return null;
  }})
 })}};
}
const user={id:"u",trialExpiresAt:0,staffActive:0};
test("Included unpublished private folder remains accessible to parent enrollment",async()=>{
 const lesson={published:0,price_inr:0,free_preview:0,trial_enabled:0,status:"available",details_json:'{"folderOnly":true}'};
 assert.deepEqual(await getLessonAccess(context(lesson,{enrolled:true,included:true}),user,"linux","lesson"),lesson);
});
test("Unpublished folder is not automatically free for an unenrolled user",async()=>{
 const lesson={published:0,price_inr:0,free_preview:1,trial_enabled:0,status:"available",details_json:'{"folderOnly":true}'};
 await assert.rejects(getLessonAccess(context(lesson,{included:true}),user,"linux","lesson"),/Lesson not available/);
});
test("Published free course still requires a free-preview flag",async()=>{
 const lesson={published:1,price_inr:0,free_preview:0,trial_enabled:0,status:"available",details_json:"{}"};
 await assert.rejects(getLessonAccess(context(lesson),user,"public","lesson"),/requires an active enrollment/);
 assert.deepEqual(await getLessonAccess(context({...lesson,free_preview:1}),user,"public","lesson"),{...lesson,free_preview:1});
});

test("Any logged-in student can watch explicitly trial-enabled paid course lessons without a grant",async()=>{
 const lesson={published:1,price_inr:2999,free_preview:0,trial_enabled:1,status:"available",details_json:"{}"};
 assert.deepEqual(await getLessonAccess(context(lesson),user,"paid","trial-lesson"),lesson);
 await assert.rejects(getLessonAccess(context({...lesson,trial_enabled:0}),user,"paid","full-lesson"),/requires an active enrollment/);
});
test("Signed-in students may watch trial lessons in included private bundle folders",async()=>{
 const lesson={published:0,price_inr:0,free_preview:0,trial_enabled:1,status:"available",details_json:'{"folderOnly":true}'};
 assert.deepEqual(await getLessonAccess(context(lesson,{included:true}),user,"bundle-folder","trial-lesson"),lesson);
 await assert.rejects(getLessonAccess(context(lesson,{included:false}),user,"not-in-published-bundle","trial-lesson"),/Lesson not available/);
});
test("Coming-soon lessons stay unavailable even when trial enabled",async()=>{
 const lesson={published:1,price_inr:2000,free_preview:0,trial_enabled:1,status:"comingSoon",details_json:"{}"};
 await assert.rejects(getLessonAccess(context(lesson),user,"coming-soon","trial-lesson"),/not available yet/);
});
