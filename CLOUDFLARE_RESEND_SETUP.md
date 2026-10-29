# InfraRivet Academy: Cloudflare D1 + Resend email OTP

**Status:** This is a safe backend migration on the `migration/cloudflare-only-auth` branch. It is not deployed. The current GitHub `main` frontend still uses Firebase; do not publish this migration until its frontend and remaining Firebase-dependent course/admin functionality are migrated and tested.

## 1. Resend

1. Open https://resend.com and create an account.
2. For real students, add a domain you control in https://resend.com/domains and complete DNS verification. **The Cloudflare `*.pages.dev` hostname is not your email-sending domain.**
3. Open https://resend.com/api-keys and create a sending API key. Do not share it in chat or commit it to GitHub.
4. Create a sender address from the verified domain, e.g. `InfraRivet Academy <login@YOUR-VERIFIED-DOMAIN>`. If only testing before verification, Resend's `onboarding@resend.dev` sender normally permits delivery only to the email address registered with Resend, not arbitrary students.

## 2. Cloudflare Pages project variables (Production)

In **Workers & Pages → infrarivet-academy-test → Settings → Variables and Secrets**, configure:

| Name | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret (encrypted) | Your private Resend API key |
| `RESEND_FROM_EMAIL` | Text | `InfraRivet Academy <login@YOUR-VERIFIED-DOMAIN>` |
| `AUTH_HASH_SECRET` | Secret (encrypted) | 32+ unpredictable characters, used to HMAC OTPs |
| `TURNSTILE_SECRET` | Secret (encrypted) | Existing Turnstile server secret |

Keep the existing build-time `VITE_TURNSTILE_SITE_KEY` for the browser. **Do not** create a `VITE_RESEND_API_KEY` — a Vite-prefixed key would be exposed publicly.

Check that **Bindings** has a D1 database binding named `DB` (the screenshot showed `infrarivet-db`).

Once code has been integrated and is ready, redeploy Pages so its Functions receive these secrets. Preview environment variables are separate from production.

## 3. Create the email-auth tables

Open Cloudflare D1 → your database → Console, and run the **SQL statements** from `migrations/0002_email_otp_auth.sql`, or use an authorized Wrangler D1 migration workflow. Do not paste the filename by itself in the SQL console. The `ir_auth_*` tables are separate from any existing course tables.

## 4. New server endpoints

| Method | URL | JSON |
| --- | --- | --- |
| POST | `/api/auth/request-code` | `{"email":"student@example.com","turnstileToken":"..."}` |
| POST | `/api/auth/verify-code` | `{"email":"student@example.com","code":"123456"}` |
| GET | `/api/auth/me` | Returns current user or `null` |
| POST | `/api/auth/logout` | Ends current session |

The endpoints use: server-side Turnstile verification, six-digit 10-minute OTPs, hashed OTP storage, 60-second resend cooldown, maximum five wrong attempts, one-time code consumption, and a seven-day HttpOnly/Secure/SameSite cookie with hashed server-side session tokens.

**Frontend integration is still pending:** the deployed website's OTP page differs from the source currently on GitHub `main`. Its API paths and request payloads must be aligned with these endpoints before deployment. Existing Firebase-backed pages also need migration to D1. Do not remove Firebase dependencies prematurely, as doing so would break existing features.

## 5. Troubleshooting

- `Email sign-in is not configured yet` (503): D1 binding or required secrets are missing.
- `Email sender is not verified in Resend` (502): verify the sender/domain, or use the restricted testing sender for your Resend account's own email.
- `Login service is not ready. Check the D1 email-auth migration` (503): run the SQL migration and confirm D1 binding `DB`.
- Turnstile verification failed (400): ensure the browser passes the Turnstile response as `turnstileToken` and that the corresponding `TURNSTILE_SECRET` is configured.

No API keys or OTPs should be logged, committed or shared.
