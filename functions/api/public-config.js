// The Turnstile site key is public by design; never expose TURNSTILE_SECRET.
export async function onRequestGet({env}) {
  return Response.json(
    {turnstileSiteKey: String(env.VITE_TURNSTILE_SITE_KEY || ""), googleClientId: String(env.GOOGLE_CLIENT_ID || ""), emailLoginEnabled: Boolean(env.DB && env.RESEND_API_KEY && env.EMAIL_FROM && env.OTP_HASH_SECRET && env.TURNSTILE_SECRET && env.VITE_TURNSTILE_SITE_KEY)},
    {headers: {"Cache-Control": "no-store"}}
  );
}
