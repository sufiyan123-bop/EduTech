# InfraRivet Academy — Free Google login on Cloudflare Pages

## Why

Resend's default `onboarding@resend.dev` sender is restricted to the account's registered email.
Resend's API also rejects the free `dynv6.net` subdomain as an unowned public domain (422).
Google Sign-In avoids Resend sending-domain restrictions, but the site owner needs a **Google OAuth Web Client ID**.

## Google Cloud steps (no Firebase project required)

1. Open https://console.cloud.google.com/auth/clients
2. Choose/create a Google Cloud project; configure the Google Auth Platform branding/consent for an **External** application as required.
3. Create **OAuth Client ID → Web application**.
4. Add **Authorized JavaScript origins**, not redirect URIs:
   - `https://infrarivet-academy-test.pages.dev`
   - If a new project is established: `https://infrarivet.pages.dev`
   - Add only the origins you will actually deploy.
5. Copy the public client ID, ending with `.apps.googleusercontent.com`.
6. In Cloudflare Pages project Settings → Variables and Secrets → Production, add **Text** variable `GOOGLE_CLIENT_ID` with the value (not secret). Do the same for Preview if preview testing is desired.
7. Deploy the approved code, then sign up at `/signup` via Google Sign-In and confirm `/dashboard` works.

**No Firebase Authentication**, no Google client secret, no paid email-sending domain needed for Google sign in. Existing Resend OTP login remains available for verified deliverable addresses.

## D1 migration

Before using the endpoint, apply `migrations/0004_google_auth.sql` to the D1 database already bound as `DB`, in Cloudflare dashboard or Wrangler. Never paste only the filename into the SQL console.

## Backend security

- `POST /api/auth/google` accepts Google's **ID token**, which is verified server-side using Google's public JWKS.
- Checks signature RS256, issuer, audience (client ID), expiry, issued-at, verified email and numeric subject.
- Gmail and Google Workspace accounts accepted; other third-party aliases not automatically trusted.
- Uses existing D1 student records and secure HttpOnly SameSite sessions, and does not automatically grant administrator permissions.
- Authenticated student identity is linked by Google's stable subject; students cannot escalate privileges using frontend data.

## Domain caveat

Cloudflare Pages free hostname can only be `<project>.pages.dev` and existing hostname cannot be renamed. A new project named `infrarivet` is needed for `infrarivet.pages.dev` if available.
A standalone bare hostname `infrarivet` is not a public web domain. Paid/custom domains are independent of OAuth and not necessary for using this site's free Cloudflare hosting.

## Other features

- The dashboard, courses, admin and learning APIs are present, but no courses or lectures have been added in D1.
- Owner/staff permissions must be assigned after the intended owner has personally verified their email or signed in with Google.
- Payment gateway and private R2 video uploads are not configured; leave them disabled. Public YouTube/video links may be used where allowed.
- Do not market as production-ready until user flows, accessibility, data migration and security tests pass.

## Admin owner account

Production Cloudflare Pages environment variable `OWNER_EMAIL` must equal the intended owner's Google-verified email address. On successful **Google ID token signature verification**, the backend creates/links the matching D1 user and grants staff role `owner` with permissions `["*"]`. No unverified or frontend-provided email can create owner permissions.

The owner must sign in via the Google button using the configured address at `https://infrarivet.pages.dev/login` after a Web OAuth client ID has been configured. The first successful verified sign-in creates the D1 owner record. The old email OTP pathway does not grant owner automatically.

**Do not manually insert a placeholder users row with an unverified email.** Existing paid-course data is preserved; never wipe D1 to set up Google auth.
