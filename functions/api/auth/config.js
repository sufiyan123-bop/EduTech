import { response } from "../../_lib/email-auth.js";

// Exposes only the public site key, never the Turnstile secret or Resend key.
export function onRequestGet({ env }) {
  const siteKey = env.VITE_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY;
  if (!siteKey) return response({ message: "Turnstile site key is not configured." }, 503);
  return response({ turnstileSiteKey: siteKey });
}
