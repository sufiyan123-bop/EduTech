import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail, randomCode, randomToken, codeHash, sha256,
  sendLoginEmail, sessionCookie, tokenFromCookie, isSameOrigin
} from "../functions/_lib/email-auth.js";

test("normalizes email and rejects malformed inputs", () => {
  assert.equal(normalizeEmail("  Student+One@Example.COM "), "student+one@example.com");
  assert.equal(normalizeEmail("no-at-sign"), null);
  assert.equal(normalizeEmail(null), null);
});
test("OTP is six digits and tokens are 256-bit hex", () => {
  for (let i = 0; i < 30; i++) assert.match(randomCode(), /^\d{6}$/);
  assert.match(randomToken(), /^[0-9a-f]{64}$/);
});
test("OTP hash binds code to email using server-only key", async () => {
  const key = "very-long-secret-at-least-32-characters";
  const one = await codeHash(key, "a@example.com", "123456");
  assert.equal(one, await codeHash(key, "a@example.com", "123456"));
  assert.notEqual(one, await codeHash(key, "b@example.com", "123456"));
  assert.notEqual(one, await codeHash(key, "a@example.com", "123457"));
  assert.equal((await sha256("token")).length, 64);
});
test("session cookies are protected and same-origin POSTs are enforced", () => {
  assert.match(sessionCookie("abc", 3600), /HttpOnly; Secure; SameSite=Lax/);
  const token = "a".repeat(64);
  assert.equal(tokenFromCookie(new Request("https://app.example.com", { headers: { Cookie: "other=x; ir_session=" + token } })), token);
  assert.equal(isSameOrigin(new Request("https://app.example.com/api/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" } })), false);
});
test("Resend receives a server-side send request without exposing the key in response", async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: "mail_123" }), { status: 200 });
  };
  try {
    const result = await sendLoginEmail({ RESEND_API_KEY: "secret-testing-key", RESEND_FROM_EMAIL: "Academy <login@example.com>" }, "student@example.com", "123456");
    assert.deepEqual(result, { ok: true, status: 200 });
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.Authorization, "Bearer secret-testing-key");
    const body = JSON.parse(request.options.body);
    assert.deepEqual(body.to, ["student@example.com"]);
    assert.match(body.text, /123456/);
  } finally { globalThis.fetch = original; }
});
