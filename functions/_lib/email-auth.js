// Shared Cloudflare Pages Function utilities. Secrets never reach the browser.
const encoder = new TextEncoder();
export const COOKIE_NAME = "ir_session";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

export function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}
export function normalizeEmail(input) {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function readJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return null;
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
export function randomCode() {
  // Rejection sampling avoids modulo bias for a six-digit secret.
  const ceiling = Math.floor(0x100000000 / 1000000) * 1000000;
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= ceiling);
  return String(values[0] % 1000000).padStart(6, "0");
}
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256(text) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export async function codeHash(secret, email, code) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(email + ":" + code));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET || typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const result = await res.json();
    return res.ok && result.success === true;
  } catch { return false; }
}
export function sessionCookie(token, maxAge) {
  return COOKIE_NAME + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
export function clearSessionCookie() { return sessionCookie("", 0); }
export function tokenFromCookie(request) {
  const cookies = request.headers.get("Cookie") || "";
  const item = cookies.split(";").map(p => p.trim()).find(p => p.startsWith(COOKIE_NAME + "="));
  const token = item?.slice(COOKIE_NAME.length + 1);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}
export async function currentUser(env, request) {
  const token = tokenFromCookie(request);
  if (!token || !env.DB) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.display_name FROM ir_auth_sessions s JOIN ir_auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
  ).bind(hash, Math.floor(Date.now() / 1000)).first();
  return row ? { id: row.id, email: row.email, name: row.display_name || "" } : null;
}
export async function sendLoginEmail(env, email, code) {
  const sender = env.RESEND_FROM_EMAIL;
  const key = env.RESEND_API_KEY;
  if (!key || !sender) return { ok: false, status: 0 };
  const payload = {
    from: sender,
    to: [email],
    subject: "Your InfraRivet Academy login code",
    text: "Your InfraRivet Academy sign-in code is " + code + ". It expires in 10 minutes. If you did not request this code, ignore this email."
  };
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: result.ok, status: result.status };
  } catch { return { ok: false, status: 0 }; }
}
