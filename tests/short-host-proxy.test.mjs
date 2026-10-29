import test from "node:test";
import assert from "node:assert/strict";
import {onRequest} from "../functions/_middleware.js";
const host="https://infrarivet.pages.dev";
test("short host forwards API requests to configured Cloudflare API, not arbitrary URLs", async ()=>{
  const original=globalThis.fetch;
  let captured;
  globalThis.fetch=async input=>{
    captured=input;
    return Response.json({ok:true},{headers:{"Set-Cookie":"infrarivet_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax"}});
  };
  try {
    const req=new Request(host+"/api/health?check=1");
    const response=await onRequest({request:req,next:()=>{throw Error("should proxy")}});
    assert.equal(new URL(captured.url).origin,"https://infrarivet-academy-test.pages.dev");
    assert.equal(new URL(captured.url).pathname,"/api/health");
    assert.equal(new URL(captured.url).search,"?check=1");
    assert.equal(response.status,200);
    assert.match(response.headers.get("Set-Cookie"),/HttpOnly/);
    assert.equal(response.headers.get("Cache-Control"),"no-store");
  } finally {globalThis.fetch=original}
});
test("short host rejects forged cross-origin POSTs before forwarding",async ()=>{
  const req=new Request(host+"/api/auth/google",{method:"POST",headers:{"Origin":"https://attacker.example","Content-Type":"application/json"},body:"{}"});
  const response=await onRequest({request:req,next:()=>{throw Error("should not call next")}});
  assert.equal(response.status,403);
});
test("trusted POST passes JSON and rewrites Origin only after validation",async ()=>{
  const original=globalThis.fetch;let input;
  globalThis.fetch=async r=>{input=r;return Response.json({signedIn:true})};
  try{
    const req=new Request(host+"/api/auth/google",{method:"POST",headers:{"Origin":host,"Content-Type":"application/json"},body:'{"credential":"test"}'});
    const res=await onRequest({request:req,next:()=>{throw Error("should not call next")}});
    assert.equal(input.headers.get("Origin"),"https://infrarivet-academy-test.pages.dev");
    assert.equal(await input.text(),'{"credential":"test"}');
    assert.equal(res.status,200);
  }finally{globalThis.fetch=original}
});
test("unrelated host and static pages stay on native Pages routes",async ()=>{
 const next=()=>Response.json({native:true});
 assert.equal((await (await onRequest({request:new Request("https://infrarivet-academy-test.pages.dev/api/health"),next})).json()).native,true);
 assert.equal((await (await onRequest({request:new Request(host+"/courses"),next})).json()).native,true);
});
