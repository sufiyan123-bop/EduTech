import { bodyJson, checkOrigin, randomToken, sha256, sessionCookie, json, fail, errorResponse } from "../../_lib/core.js";
import { verifyGoogleIdentity } from "../../_lib/google.js";

export async function onRequestPost(ctx) {
  try {
    checkOrigin(ctx.request);
    if (!ctx.env.DB) fail(503,"Database not configured");
    const body=await bodyJson(ctx.request,12000);
    const identity=await verifyGoogleIdentity(body.credential,ctx.env.GOOGLE_CLIENT_ID);
    let linked=await ctx.env.DB.prepare("SELECT user_id FROM google_identities WHERE google_sub=?").bind(identity.sub).first();
    let userId=linked?.user_id;
    if (!userId) {
      let u=await ctx.env.DB.prepare("SELECT id,auth_provider FROM users WHERE email=? COLLATE NOCASE").bind(identity.email).first();
      if (u && u.auth_provider==="password_unverified") fail(403,"This account needs email verification before it can be linked");
      if (!u) {
        const newId=crypto.randomUUID();
        await ctx.env.DB.prepare("INSERT INTO users (id,email,display_name,auth_provider) VALUES (?,?,?,'google_oidc') ON CONFLICT(email) DO NOTHING")
          .bind(newId,identity.email,identity.name).run();
        u=await ctx.env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(identity.email).first();
      }
      if (!u) fail(503,"Could not create Google account");
      userId=u.id;
      // Unique user_id constraint prevents linking multiple Google subjects to one account.
      await ctx.env.DB.prepare("INSERT INTO google_identities (google_sub,user_id,email) VALUES (?,?,?) ON CONFLICT(google_sub) DO NOTHING")
        .bind(identity.sub,userId,identity.email).run();
      linked=await ctx.env.DB.prepare("SELECT user_id FROM google_identities WHERE google_sub=?").bind(identity.sub).first();
      if (linked?.user_id!==userId) fail(409,"Google account is already linked differently");
    }
    const token=randomToken(),now=Math.floor(Date.now()/1000),maxAge=60*60*24*14;
    await ctx.env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)")
      .bind(await sha256(token),userId,now+maxAge).run();
    return json({signedIn:true},200,{"Set-Cookie":sessionCookie(ctx.request,token,maxAge)});
  } catch(e) { return errorResponse(e); }
}
