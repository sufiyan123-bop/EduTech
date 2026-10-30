import test from "node:test";
import assert from "node:assert/strict";
import {resolveThumbnailUrl} from "../functions/_lib/thumbnail.js";

const oldFetch=globalThis.fetch;
test("ImgBB share page converts into its real og:image URL",async()=>{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,"https://ibb.co/fzQ8DPTc");
  assert.equal(options.redirect,"error");
  return new Response('<html><meta property="og:image" content="https://i.ibb.co/LXvQN2sG/15451-1.jpg"></html>',{status:200,headers:{"Content-Type":"text/html"}});
 };
 try{assert.equal(await resolveThumbnailUrl("  https://ibb.co/fzQ8DPTc  "),"https://i.ibb.co/LXvQN2sG/15451-1.jpg");}
 finally{globalThis.fetch=oldFetch;}
});
test("Direct image URL remains valid and does not trigger remote fetch",async()=>{
 globalThis.fetch=async()=>{throw Error("should not fetch a direct image link");};
 try{assert.equal(await resolveThumbnailUrl("https://i.ibb.co/LXvQN2sG/15451-1.jpg"),"https://i.ibb.co/LXvQN2sG/15451-1.jpg");}
 finally{globalThis.fetch=oldFetch;}
});
test("Empty thumbnail is allowed",async()=>{assert.equal(await resolveThumbnailUrl("  "),"");});
test("Unsafe schemes and imgBB impostors are rejected or never fetched",async()=>{
 globalThis.fetch=async()=>{throw Error("must not fetch unknown hosts");};
 try{
  await assert.rejects(resolveThumbnailUrl("javascript:alert(1)"),e=>e.status===400);
  assert.equal(await resolveThumbnailUrl("https://ibb.co.evil.example/dummy"),"https://ibb.co.evil.example/dummy");
 }finally{globalThis.fetch=oldFetch;}
});
test("ImgBB unsafe og:image output is rejected",async()=>{
 globalThis.fetch=async()=>new Response('<meta property="og:image" content="https://evil.example/payload.jpg">');
 try{await assert.rejects(resolveThumbnailUrl("https://ibb.co/fzQ8DPTc"),e=>e.status===400);}
 finally{globalThis.fetch=oldFetch;}
});
