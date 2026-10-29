import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/auth/request.js";

const origin = "https://preview.example.pages.dev";
function env() {
  return {
    DB: { prepare(sql) {
      return { bind(...params) {
        return {
          first: async () => null,
          run: async () => ({ success: true })
        };
      }};
    }},
    RESEND_API_KEY: "test-server-only-key",
    EMAIL_FROM: "onboarding@resend.dev",
    OTP_HASH_SECRET: "test-otp-secret-longer-than-thirty-two-chars",
    TURNSTILE_SECRET: "test-turnstile-secret"
  };
}
function ctx(email = "student@example.com") {
  return { env: env(), request: new Request(origin + "/api/auth/request", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, turnstileToken: "test-token" })
  })};
}
test("authentication refuses cross-origin requests", async () => {
  const c = ctx();
  c.request = new Request(origin + "/api/auth/request", {
    method: "POST", headers: { Origin: "https://other.example", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "student@example.com", turnstileToken: "test" })
  });
  const response = await onRequestPost(c);
  assert.equal(response.status, 403);
});
test("missing server config gives actionable but non-secret error", async () => {
  const c = ctx();
  c.env.RESEND_API_KEY = null;
  const response = await onRequestPost(c);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
});
test("Resend 403 explains sender testing restriction and never returns key", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("siteverify")) return Response.json({ success: true });
    return new Response(JSON.stringify({ message: "testing domain restriction" }), { status: 403 });
  };
  try {
    const response = await onRequestPost(ctx());
    assert.equal(response.status, 503);
    const error = (await response.json()).error;
    assert.match(error, /Resend testing sender/);
    assert.ok(!error.includes("test-server-only-key"));
  } finally { globalThis.fetch = oldFetch; }
});
test("successful Resend response completes the OTP request", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("siteverify")) return Response.json({ success: true });
    return Response.json({ id: "email_test" });
  };
  try {
    const response = await onRequestPost(ctx());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sent, true);
  } finally { globalThis.fetch = oldFetch; }
});
