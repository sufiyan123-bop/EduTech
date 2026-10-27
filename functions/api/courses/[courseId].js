// Public catalog details and syllabus ONLY. Protected playback requires a separate
// authenticated endpoint checking active enrollment (including parent bundles).
export async function onRequestGet({ env, params }) {
  if (!env.DB) return Response.json({ error: "Service not configured" }, { status: 503 });
  const id = String(params.courseId || "");
  if (!id || id.length > 160) return Response.json({ error: "Invalid course ID" }, { status: 400 });
  try {
    const course = await env.DB.prepare(
      "SELECT id, title, description, track, price_inr AS price, thumbnail, status, featured FROM courses WHERE id = ? AND published = 1"
    ).bind(id).first();
    if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
    const [included, lessons] = await Promise.all([
      env.DB.prepare(
        `SELECT c.id, c.title, c.description, c.thumbnail, c.track
         FROM course_inclusions i JOIN courses c ON c.id = i.child_course_id
         WHERE i.parent_course_id = ? AND c.published = 1
         ORDER BY i.sort_order ASC, c.title ASC`
      ).bind(id).all(),
      env.DB.prepare(
        `SELECT id, title, sort_order AS "order", trial_enabled AS trialEnabled,
                free_preview AS freePreview
         FROM lectures WHERE course_id = ? ORDER BY sort_order ASC, title ASC`
      ).bind(id).all()
    ]);
    return Response.json({
      course,
      includedCourses: included.results || [],
      lectures: (lessons.results || []).map(l => ({
        ...l, trialEnabled: Boolean(l.trialEnabled), freePreview: Boolean(l.freePreview)
      }))
    }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "Course details unavailable" }, { status: 503 });
  }
}
