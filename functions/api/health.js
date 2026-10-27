export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: false, message: "D1 database binding is missing" }, { status: 503 });
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return Response.json({ ok: true, service: "edutech-api" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }
}
