// Verify Google Identity Services ID tokens server-side. Never trust decoded JWTs before signature verification.
import { validateEmail, fail } from "./core.js";

function base64UrlBytes(part) {
  if (typeof part !== "string" || !/^[a-zA-Z0-9_-]+$/.test(part) || part.length > 11000) fail(401, "Invalid Google sign-in token");
  const str = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(str + "=".repeat((4 - str.length % 4) % 4));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
function parseJson(part) {
  try { return JSON.parse(new TextDecoder().decode(base64UrlBytes(part))); }
  catch { fail(401, "Invalid Google sign-in token"); }
}
let cached = { until: 0, keys: [] };
async function publicKeys(force = false) {
  if (!force && Date.now() < cached.until && cached.keys.length) return cached.keys;
  let res;
  try { res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {headers: {"Accept":"application/json"}}); }
  catch { fail(503, "Google sign-in verification is temporarily unavailable"); }
  if (!res.ok) fail(503, "Google sign-in verification is temporarily unavailable");
  let data;
  try { data = await res.json(); }
  catch { fail(503, "Google sign-in verification is temporarily unavailable"); }
  if (!Array.isArray(data.keys) || data.keys.length === 0) fail(503, "Google sign-in verification is temporarily unavailable");
  const maxAge = Number(res.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] || "600");
  cached = { keys: data.keys.filter(k=>k.kty==="RSA"&&k.alg==="RS256"&&k.use==="sig"), until: Date.now()+Math.min(Math.max(maxAge,60),3600)*1000 };
  return cached.keys;
}
export async function verifyGoogleIdentity(credential, clientId) {
  if (typeof clientId!=="string" || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) fail(503, "Google Sign-In is not configured");
  if (typeof credential!=="string" || credential.length>10000) fail(401, "Invalid Google sign-in token");
  const parts=credential.split(".");
  if (parts.length!==3) fail(401, "Invalid Google sign-in token");
  const header=parseJson(parts[0]);
  if (header.alg!=="RS256" || typeof header.kid!=="string" || !header.kid || header.crit) fail(401, "Invalid Google sign-in token");
  let keys=await publicKeys();
  let jwk=keys.find(k=>k.kid===header.kid);
  if (!jwk) { keys=await publicKeys(true); jwk=keys.find(k=>k.kid===header.kid); }
  if (!jwk) fail(401, "Google sign-in token key is not recognized");
  let valid=false;
  try {
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64UrlBytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  } catch { valid=false; }
  if (!valid) fail(401, "Invalid Google sign-in token");
  const payload=parseJson(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if (!["accounts.google.com","https://accounts.google.com"].includes(payload.iss)
    || payload.aud!==clientId || !Number.isInteger(payload.exp) || payload.exp<=now
    || !Number.isInteger(payload.iat) || payload.iat>now+60 || payload.iat<now-7200
    || payload.email_verified!==true || typeof payload.sub!=="string"
    || !/^[0-9]{10,50}$/.test(payload.sub)) fail(401, "Google sign-in token has invalid claims");
  const email=validateEmail(payload.email);
  // For non-Gmail accounts, email_verified can be stale unless Google is authoritative.
  if (!email.endsWith("@gmail.com") && (!payload.hd || typeof payload.hd!=="string" || !email.endsWith("@"+payload.hd.toLowerCase()))) {
    fail(403,"Use a Gmail or verified Google Workspace account for this sign-in method");
  }
  return { sub: payload.sub, email, name: String(payload.name||"").trim().slice(0,100) || email.split("@")[0] };
}
