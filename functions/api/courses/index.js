// Public course catalog: never expose student data, private video IDs or R2 object keys.
export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: "Service not configured" }, { status: 503 });
  try {
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.title, c.description, c.track, c.price_inr AS price,
              c.thumbnail, c.status, c.featured, c.sort_order AS homeOrder,
              (SELECT COUNT(*) FROM course_inclusions i WHERE i.parent_course_id = c.id) AS includedCount
       FROM courses c
       WHERE c.published = 1 AND NOT EXISTS (
         SELECT 1 FROM course_inclusions i WHERE i.child_course_id = c.id
       )
       ORDER BY c.featured DESC, c.sort_order ASC, c.title COLLATE NOCASE ASC`
    ).all();
    return Response.json({ courses: results || [] }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "Course catalog unavailable" }, { status: 503 });
  }
}
