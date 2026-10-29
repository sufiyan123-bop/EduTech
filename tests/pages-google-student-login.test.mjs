import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {onRequestGet} from "../functions/api/public-config.js";

const CLIENT_ID="886691585387-test.apps.googleusercontent.com";

test("InfraRivet Pages serves its own API instead of proxying to the test project",()=>{
  assert.equal(existsSync(new URL("../functions/_middleware.js",import.meta.url)),false,
    "Remove the cross-project API bridge; it hides production Google settings and causes student login failures");
});

test("Google-only production configuration exposes Google login and disables unavailable email OTP",async()=>{
  const response=await onRequestGet({env:{DB:{},GOOGLE_CLIENT_ID:CLIENT_ID,OWNER_EMAIL:"owner@example.com"}});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.googleClientId,CLIENT_ID);
  assert.equal(data.emailLoginEnabled,false);
  assert.equal(data.turnstileSiteKey,"");
  assert.equal(JSON.stringify(data).includes("OWNER_EMAIL"),false);
});

test("Email OTP is advertised only if all necessary production bindings exist",async()=>{
  const env={DB:{},GOOGLE_CLIENT_ID:CLIENT_ID,RESEND_API_KEY:"test",EMAIL_FROM:"test@example.org",OTP_HASH_SECRET:"hash",TURNSTILE_SECRET:"secret",VITE_TURNSTILE_SITE_KEY:"0x-test"};
  const data=await (await onRequestGet({env})).json();
  assert.equal(data.emailLoginEnabled,true);
});
