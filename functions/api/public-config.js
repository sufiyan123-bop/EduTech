// The Turnstile site key is public by design; never expose TURNSTILE_SECRET.
export async function onRequestGet({env}) {
  return Response.json(
    {turnstileSiteKey: String(env.VITE_TURNSTILE_SITE_KEY || ""), googleClientId: String(env.GOOGLE_CLIENT_ID || "")},
    {headers: {"Cache-Control": "no-store"}}
  );
}
