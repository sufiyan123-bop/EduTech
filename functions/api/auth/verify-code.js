import { codeHash, isSameOrigin, normalizeEmail, randomToken, readJson, response, sessionCookie, sha256 } from "../../_lib/email-auth.js";

const SESSION_AGE = 60 * 60 * 24 * 7; // 7 days
export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return response({ message: "Invalid request origin." }, 403);
  if (!env.DB || !env.AUTH_HASH_SECRET || env.AUTH_HASH_SECRET.length < 32) {
    return response({ message: "Email sign-in is not configured yet." }, 503);
  }
  const data = await readJson(request);
  const email = normalizeEmail(data?.email);
  const code = data?.code;
  if (!email || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return response({ message: "Enter the six-digit code from your email." }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const suppliedHash = await codeHash(env.AUTH_HASH_SECRET, email, code);
    // Atomic consumption prevents a code from being used twice.
    const consumed = await env.DB.prepare(
      "UPDATE ir_auth_codes SET used_at = ? WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ? AND attempts < 5"
    ).bind(now, email, suppliedHash, now).run();
    if (!consumed.meta?.changes) {
      await env.DB.prepare(
        "UPDATE ir_auth_codes SET attempts = attempts + 1 WHERE email = ? AND used_at IS NULL AND expires_at > ? AND attempts < 5"
      ).bind(email, now).run();
      return response({ message: "Invalid or expired code. Request a new code if needed." }, 401);
    }

    await env.DB.prepare(
      "INSERT INTO ir_auth_users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING"
    ).bind(crypto.randomUUID(), email, now).run();
    const user = await env.DB.prepare("SELECT id, email, display_name FROM ir_auth_users WHERE email = ?").bind(email).first();
    if (!user) throw new Error("Account creation failed");
    const token = randomToken();
    await env.DB.prepare(
      "INSERT INTO ir_auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(await sha256(token), user.id, now, now + SESSION_AGE).run();
    return response(
      { ok: true, user: { id: user.id, email: user.email, name: user.display_name || "" } },
      200,
      { "Set-Cookie": sessionCookie(token, SESSION_AGE) }
    );
  } catch (error) {
    console.error("Email verification failed", error?.message);
    return response({ message: "Unable to complete sign-in. Check the D1 authentication setup." }, 503);
  }
}
