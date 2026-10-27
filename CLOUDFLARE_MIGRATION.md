# EduTech: Firebase → Cloudflare migration (staging only)

> Status: **NOT PRODUCTION READY**. This branch prepares D1 and Pages Functions.
> The existing site on `main` still relies on Firebase for Auth, Firestore and
> administration, and on the existing payment API. Do NOT disable Firebase or
> switch customer traffic until every checklist item is tested.

## Target architecture

- **Cloudflare Pages:** React/Vite frontend, Git-connected deployments.
- **Cloudflare Pages Functions / Workers:** authenticated API, Razorpay
  create-order/verification/webhooks, enrollment checks and short-lived video
  authorizations.
- **Cloudflare D1:** users, catalog, bundle relations, lectures, enrollments,
  progress, staff and payment orders (schema in `migrations/`).
- **Cloudflare R2:** optional private videos and thumbnails; never expose bucket
  credentials or unrestricted object URLs.
- **Authentication:** replace Firebase Auth with a secure session/auth provider
  implemented on Cloudflare. Existing Firebase Auth passwords cannot simply
  be read as plaintext; plan user identity mapping and password-reset/login
  transition carefully.
- **Existing Razorpay:** keep provider, reimplement server-side signature
  verification and webhook idempotency on Cloudflare before enabling checkout.

## What this branch already adds

- D1 tables for parent course → included course → lectures, users, access,
  progress, staff, and payment orders.
- **Read-only public** Pages Functions: `GET /api/health`,
  `GET /api/courses`, `GET /api/courses/:courseId`.
- SPA fallback: `public/_redirects`.

These API endpoints are not yet called by the existing React app. There is no
working Cloudflare login, purchases, admin panel, or private video playback yet.

## Cloudflare account setup (must be done by the account owner)

1. Visit https://dash.cloudflare.com/ and create/sign into the account.
2. **D1:** create a database named `edutech-db`, then bind it to the Pages
   project as `DB` under Settings → Bindings (also configure Preview).
3. **R2:** create a private bucket `edutech-videos` when moving videos.
   Bind it to a Worker/Pages Function as `VIDEOS`. Do not publish private
   videos through a public bucket URL.
4. **Pages:** Workers & Pages → Create application → Pages → Import Git repo
   `sufiyan123-bop/EduTech`. During testing choose the
   `cloudflare-migration` branch as the production branch of the **test
   project**, never the existing production domain.
5. Build command: `npm run build`. Output: `dist`. Root: repository root.
6. Bind D1 and deploy. With an empty D1 database, health will be healthy,
   but the catalog will be empty. Existing Firebase-dependent frontend will
   not function until the React data layer is migrated.
7. Apply the schema using Wrangler:
   `npx wrangler d1 migrations apply edutech-db --remote`
   (requires a Wrangler configuration with the actual D1 database ID;
   do not commit Cloudflare credentials). Confirm the commands and database
   match the desired Cloudflare account before applying.

## Required before production cutover

- [ ] Back up Firestore collections (courses, lectureCatalog, private lectures,
      users, enrollments, progress, staff, tracks, payment records) and
      Firebase Auth users. Back up any Storage objects separately.
- [ ] Implement a tested one-time/verified repeatable migration to D1 with
      counts, sample records and enrollment expiry times checked.
- [ ] Implement secure identity transition / password resets and
      cookie-based sessions. Preserve user IDs or remap all relationships.
- [ ] Replace every `firebase/*` import in frontend and API code; update
      sign-in, sign-up, home, courses, course details, admin, dashboard, learn.
- [ ] Reimplement admin permissions server-side and ensure forbidden operations
      are rejected (not just hidden in React).
- [ ] Reimplement bundle-based access, expiry checks, free trial and progress.
- [ ] Migrate private videos to R2 if desired, use short-lived access
      authorization and HTTP Range streaming. Avoid putting paid videos on
      publicly accessible R2 URLs.
- [ ] Port Razorpay server order creation, signature verification, secure
      webhooks, payment reconciliation and idempotent enrollment grants.
- [ ] Run full end-to-end tests: student login, bundle purchase, child lesson
      playback, completion, admin upload, refunds/expiry, mobile views.
- [ ] Test Cloudflare Pages preview with migrated data and an isolated
      test payment environment.
- [ ] Only then point a domain to Cloudflare and decommission Vercel/Firebase.

## Data safety

**Do not delete the Firebase project, remove its keys or change live DNS yet.**
Never paste API secrets, Firebase service-account JSON, Cloudflare tokens,
Razorpay secret keys or password exports into GitHub or this chat.

Sources: https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
and https://developers.cloudflare.com/pages/functions/bindings/ .
