import test from "node:test";
import assert from "node:assert/strict";
import { canWatchLecture } from "../src/utils/lectureAccess.js";

const paid = { published: true, price: 2999, status: "available" };
const folder = { published: false, folderOnly: true, price: 0, status: "available" };
const trialLesson = { trialEnabled: true, freePreview: false };
const freeLesson = { trialEnabled: false, freePreview: true };

test("enrollment unlocks a private child course", () => {
 assert.equal(canWatchLecture({ course: folder, lecture: freeLesson, enrolled: true }), true);
});
test("unpublished bundle folder does not become free because its price is zero", () => {
 assert.equal(canWatchLecture({ course: folder, lecture: freeLesson }), false);
});
test("an signed-in learner can open a trial-enabled bundle folder lecture", () => {
 assert.equal(canWatchLecture({ course: folder, lecture: trialLesson, signedIn: true }), true);
 assert.equal(canWatchLecture({ course: folder, lecture: trialLesson, signedIn: false }), false);
});
test("paid course lectures stay locked without enrollment or signed-in free trial", () => {
 assert.equal(canWatchLecture({ course: paid, lecture: freeLesson }), false);
 assert.equal(canWatchLecture({ course: paid, lecture: trialLesson, signedIn: true }), true);
});
test("free preview works only for published free-priced courses", () => {
 assert.equal(canWatchLecture({ course: { ...paid, price: 0 }, lecture: freeLesson }), true);
 assert.equal(canWatchLecture({ course: paid, lecture: null, enrolled: true }), false);
});
test("coming soon courses do not allow trial access", () => {
 assert.equal(canWatchLecture({ course: { ...folder, status: "comingSoon" }, lecture: trialLesson, signedIn: true }), false);
});

test("trial requires login but not an expiry timestamp", () => {
 assert.equal(canWatchLecture({course:paid,lecture:trialLesson,signedIn:false}),false);
 assert.equal(canWatchLecture({course:paid,lecture:trialLesson,signedIn:true}),true);
 assert.equal(canWatchLecture({course:paid,lecture:freeLesson,signedIn:true}),false);
});
