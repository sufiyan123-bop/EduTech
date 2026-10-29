import { clearSessionCookie, isSameOrigin, response, sha256, tokenFromCookie } from "../../_lib/email-auth.js";
export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return response({ message: "Invalid request origin." }, 403);
  const token = tokenFromCookie(request);
  if (token && env.DB) {
    try {
      await env.DB.prepare("DELETE FROM ir_auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    } catch (error) {
      console.error("Session removal failed", error?.message);
      return response({ message: "Could not sign out. Please try again." }, 503);
    }
  }
  return response({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
