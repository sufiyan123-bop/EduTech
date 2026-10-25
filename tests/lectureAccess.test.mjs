import test from "node:test";
import assert from "node:assert/strict";
import { canWatchLecture } from "../src/utils/lectureAccess.js";
const paid={published:true,status:"available",price:2999};
const free={published:true,status:"available",price:0};
test("paid course is locked for a signed-in non-enrolled student",()=>assert.equal(canWatchLecture({course:paid,lecture:{freePreview:true},trialActive:false}),false));
test("an active trial unlocks only trial-enabled paid lectures",()=>{
 assert.equal(canWatchLecture({course:paid,lecture:{trialEnabled:true},trialActive:true}),true);
 assert.equal(canWatchLecture({course:paid,lecture:{trialEnabled:false},trialActive:true}),false);
});
test("expired trial cannot play paid lessons",()=>assert.equal(canWatchLecture({course:paid,lecture:{trialEnabled:true},trialActive:false}),false));
test("enrollment unlocks all lessons including unpublished course content",()=>assert.equal(canWatchLecture({course:{...paid,published:false},lecture:{},enrolled:true}),true));
test("a free course allows specifically marked free previews",()=>{
 assert.equal(canWatchLecture({course:free,lecture:{freePreview:true}}),true);
 assert.equal(canWatchLecture({course:free,lecture:{freePreview:false}}),false);
});
test("coming-soon and draft courses cannot provide trial access",()=>{
 assert.equal(canWatchLecture({course:{...paid,published:false},lecture:{trialEnabled:true},trialActive:true}),false);
 assert.equal(canWatchLecture({course:{...paid,status:"comingSoon"},lecture:{trialEnabled:true},trialActive:true}),false);
});
test("missing lecture never plays",()=>assert.equal(canWatchLecture({course:paid,lecture:null,enrolled:true}),false));
