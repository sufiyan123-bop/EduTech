import { codeHash, isSameOrigin, normalizeEmail, randomCode, readJson, response, sendLoginEmail, verifyTurnstile } from "../../_lib/email-auth.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return response({ message: "Invalid request origin." }, 403);
  if (!env.DB || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.AUTH_HASH_SECRET || env.AUTH_HASH_SECRET.length < 32 || !env.TURNSTILE_SECRET) {
    return response({ message: "Email sign-in is not configured yet." }, 503);
  }
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return response({ message: "Enter a valid email address." }, 400);
  const ip = request.headers.get("CF-Connecting-IP");
  const verified = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!verified) return response({ message: "Complete the security check and try again." }, 400);

  const now = Math.floor(Date.now() / 1000);
  const code = randomCode();
  const hash = await codeHash(env.AUTH_HASH_SECRET, email, code);
  try {
    const insert = await env.DB.prepare(
      "INSERT INTO ir_auth_codes (email, code_hash, expires_at, attempts, last_sent_at) VALUES (?, ?, ?, 0, ?) " +
      "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, " +
      "attempts = 0, last_sent_at = excluded.last_sent_at, used_at = NULL " +
      "WHERE ir_auth_codes.last_sent_at <= ?"
    ).bind(email, hash, now + 600, now, now - 60).run();
    if (!insert.meta?.changes) return response({ message: "Please wait one minute before requesting another code." }, 429);

    const sent = await sendLoginEmail(env, email, code);
    if (!sent.ok) {
      // Never leave an undelivered code usable.
      await env.DB.prepare("DELETE FROM ir_auth_codes WHERE email = ? AND code_hash = ?").bind(email, hash).run();
      console.error("Resend delivery failed with status", sent.status);
      return response({ message: sent.status === 403
        ? "Email sender is not verified in Resend. Verify your sending domain."
        : "We could not send the login code. Please try again later." }, 502);
    }
    return response({ ok: true, message: "A six-digit login code was sent to your email." });
  } catch (error) {
    console.error("Email-code request failed", error?.message);
    return response({ message: "Login service is not ready. Check the D1 email-auth migration." }, 503);
  }
}
