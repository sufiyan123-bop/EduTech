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
test("an active trial can open a trial-enabled bundle folder lecture", () => {
 assert.equal(canWatchLecture({ course: folder, lecture: trialLesson, trialActive: true }), true);
 assert.equal(canWatchLecture({ course: folder, lecture: trialLesson, trialActive: false }), false);
});
test("paid course lectures stay locked without enrollment or eligible trial", () => {
 assert.equal(canWatchLecture({ course: paid, lecture: freeLesson }), false);
 assert.equal(canWatchLecture({ course: paid, lecture: trialLesson, trialActive: true }), true);
});
test("free preview works only for published free-priced courses", () => {
 assert.equal(canWatchLecture({ course: { ...paid, price: 0 }, lecture: freeLesson }), true);
 assert.equal(canWatchLecture({ course: paid, lecture: null, enrolled: true }), false);
});
test("coming soon courses do not allow trial access", () => {
 assert.equal(canWatchLecture({ course: { ...folder, status: "comingSoon" }, lecture: trialLesson, trialActive: true }), false);
});
