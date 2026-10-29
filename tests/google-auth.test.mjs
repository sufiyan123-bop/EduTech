import test from "node:test";
import assert from "node:assert/strict";
import { verifyGoogleIdentity } from "../functions/_lib/google.js";

const clientId="111111111111-exampleclient.apps.googleusercontent.com";
const originFetch=globalThis.fetch;
const now=()=>Math.floor(Date.now()/1000);
const b64=x=>Buffer.from(typeof x==="string"?x:JSON.stringify(x)).toString("base64url");

async function signingSetup(){
 const keys=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const jwk=await crypto.subtle.exportKey("jwk",keys.publicKey);
 jwk.kid="key-one";jwk.alg="RS256";jwk.use="sig";
 globalThis.fetch=async url=>{
   assert.equal(url,"https://www.googleapis.com/oauth2/v3/certs");
   return Response.json({keys:[jwk]},{headers:{"Cache-Control":"public, max-age=600"}});
 };
 async function sign(payload, header={kid:"key-one",alg:"RS256",typ:"JWT"}){
  const signingInput=b64(header)+"."+b64(payload);
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(signingInput));
  return signingInput+"."+Buffer.from(signature).toString("base64url");
 }
 const claims={iss:"https://accounts.google.com",aud:clientId,sub:"100000000000000000001",email:"Student@gmail.com",email_verified:true,name:"Demo Student",iat:now(),exp:now()+3600};
 return {sign,claims,restore:()=>{globalThis.fetch=originFetch}};
}
test("Google JWT validates real signature and verified Gmail identity", async ()=>{
 const setup=await signingSetup();
 try {
  const t=await setup.sign(setup.claims);
  const identity=await verifyGoogleIdentity(t,clientId);
  assert.equal(identity.email,"student@gmail.com");
  assert.equal(identity.sub,setup.claims.sub);
  assert.equal(identity.name,"Demo Student");
 } finally {setup.restore()}
});
test("Google JWT rejects forged, expired, and unverified credentials", async ()=>{
 const setup=await signingSetup();
 try {
  const badAud=await setup.sign({...setup.claims,aud:"attacker.apps.googleusercontent.com"});
  await assert.rejects(verifyGoogleIdentity(badAud,clientId),/invalid claims/);
  const expired=await setup.sign({...setup.claims,exp:now()-1});
  await assert.rejects(verifyGoogleIdentity(expired,clientId),/invalid claims/);
  const unverified=await setup.sign({...setup.claims,email_verified:false});
  await assert.rejects(verifyGoogleIdentity(unverified,clientId),/invalid claims/);
  const valid=await setup.sign(setup.claims);
  await assert.rejects(verifyGoogleIdentity(valid.slice(0,-2)+"aa",clientId),/Invalid Google sign-in token/);
 } finally {setup.restore()}
});
test("Google JWT restricts non-authoritative external email aliases", async ()=>{
 const setup=await signingSetup();
 try {
  const external=await setup.sign({...setup.claims,email:"student@custom-domain.org"});
  await assert.rejects(verifyGoogleIdentity(external,clientId),/Gmail or verified Google Workspace/);
  const workspace=await setup.sign({...setup.claims,email:"student@workspace.org",hd:"workspace.org"});
  assert.equal((await verifyGoogleIdentity(workspace,clientId)).email,"student@workspace.org");
 } finally {setup.restore()}
});
