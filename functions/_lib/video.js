import {fail} from "./core.js";

// YouTube links are outside our access-control boundary. Even "unlisted" IDs
// can be copied or viewed outside the Academy. Never treat them as paywall DRM.
export const PAID_YOUTUBE_ERROR = "Paid lessons cannot use YouTube links: the video ID can be shared outside InfraRivet. Use private video hosting for paid material.";

export async function assertYoutubeSafeForCourse(env, courseId, youtubeId, coursePrice) {
  if (!youtubeId) return;
  if (Number(coursePrice) > 0) fail(409, PAID_YOUTUBE_ERROR);
  const parent = await env.DB.prepare(
    "SELECT p.price_inr AS price FROM course_inclusions i JOIN courses p ON p.id=i.parent_course_id " +
    "WHERE i.child_course_id=? AND p.price_inr>0 LIMIT 1"
  ).bind(courseId).first();
  if (parent) fail(409, PAID_YOUTUBE_ERROR);
}

export async function assertNoYoutubeWhenPaywalled(env, courseId, includedCourseIds, price) {
  const parent = await env.DB.prepare(
    "SELECT p.price_inr AS price FROM course_inclusions i JOIN courses p ON p.id=i.parent_course_id " +
    "WHERE i.child_course_id=? AND p.price_inr>0 LIMIT 1"
  ).bind(courseId).first();
  if (Number(price) <= 0 && !parent) return;
  // Editing a paid bundle must check the entire bundle before making it paid.
  const ids = Number(price)>0 ? [courseId,...includedCourseIds] : [courseId];
  const unique = [...new Set(ids)];
  const query = "SELECT id FROM lectures WHERE youtube_id IS NOT NULL AND trim(youtube_id)<>'' AND course_id IN (" +
    unique.map(()=>"?").join(",") + ") LIMIT 1";
  const row = await env.DB.prepare(query).bind(...unique).first();
  if (row) fail(409, PAID_YOUTUBE_ERROR);
}
