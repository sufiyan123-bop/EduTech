# EduTech → Cloudflare migration

## Current status

**Staging implementation, not production live.** The `cloudflare-migration` branch has:
- Cloudflare Pages/Vite React frontend with Home, course catalog, bundle detail, email-OTP sign-in,
  student dashboard and **left-side learning path / right-side private video player**.
- Pages Functions APIs for public catalog, private playback, studied progress, D1 admin
  CRUD, private MP4/WebM R2 uploads, enrollments and owner/team permissions.
- Razorpay server-side order/verification/webhook integration (disabled by default).
- D1 schema migrations and **read-only one-time Firebase export to D1**.
- CI checks on this branch.

It still requires Cloudflare account bindings and credentials, safe data import, user
identity verification, end-to-end live testing and final domain cutover.

**Do not delete Firebase or switch edutech-in.vercel.app yet.**

## Target architecture

Cloudflare Pages (React/Vite) + Pages Functions (API) + Cloudflare D1 (database)
+ private Cloudflare R2 (course videos) + Cloudflare Turnstile (login bot protection)
+ Resend (email login codes) + Razorpay (payments).

The runtime frontend and Cloudflare API have no Firebase dependency. The isolated
`migration-tools/` script temporarily requires Firebase Admin **only to export
old data**. It can be deleted once migration is verified and backed up.

### Part A — Cloudflare account and resources

1. In https://dash.cloudflare.com/ create your account and connect GitHub.
2. **D1**: create `edutech-db`, note database ID. Bind it to your **new, isolated Pages
   project** with variable name `DB` under Settings → Bindings (Preview and Production).
3. **R2**: create bucket `edutech-videos`. Keep it **private**. Bind R2 bucket to your
   Pages project using variable `VIDEOS`. Do not enable public access.
4. **Pages**: Create application → Pages → Connect to GitHub → select
   `sufiyan123-bop/EduTech`; test using `cloudflare-migration` branch in a new
   project. Build command `npm run build`, output directory `dist`, root `/`.
   Do **not** connect your paid live domain until verified.
5. **Turnstile**: create widget for your Cloudflare Pages test hostname (and later
   live domain). Set `VITE_TURNSTILE_SITE_KEY` as a **public build variable**;
   `TURNSTILE_SECRET` as a **server-only secret** in Pages.
6. **Resend**: get a verified sending domain from https://resend.com/.
   In Pages server-only environment secrets set `RESEND_API_KEY` and
   `EMAIL_FROM` (example `EduTech <login@yourdomain.com>`).
   This is needed for email OTP sign-in. Existing Firebase passwords cannot be
   read or copied; migrated students sign in by proving ownership of their email.
7. Generate `OTP_HASH_SECRET` as a cryptographically random, at least 32-character
   string. Add it as a server-only secret. Do not share it in chat.
8. Rebuild/redeploy Pages whenever changing binding or build-time variables.

Cloudflare Pages binds resources to `env.DB` and `env.VIDEOS` in Functions.
**Never put API secret keys in a `VITE_*` variable.**

### Part B — Initialize D1

Using Wrangler v4, with a local Wrangler configuration linked to your own D1
database ID (see Cloudflare Pages Wrangler configuration docs), apply migrations:

```bash
npm install
npx wrangler login
npx wrangler d1 migrations apply edutech-db --remote
```

The Wrangler config with your actual database ID can stay local; if you use a
Wrangler config in Git, review how it affects Pages production bindings before
committing. Alternatively use Cloudflare dashboard's D1 console to execute the
two versioned SQL migration files in order.

You must apply **0001_cloudflare_core.sql** and **0002_auth.sql** before using the API.
Check `/api/health` after binding DB.

### Part C — Export old Firebase data safely

1. Take your own backups of **Firebase Auth, Firestore collections and Storage**.
   Ensure you can restore before attempting changes.
2. On a trusted local computer, download a Firebase *service-account* JSON via
   Firebase service account settings, place it **outside the GitHub repository**,
   and provide its local path via `GOOGLE_APPLICATION_CREDENTIALS`.
3. One-time, read-only export:

```bash
cd migration-tools
npm install
# export GOOGLE_APPLICATION_CREDENTIALS=/absolute/local/path/service-account.json
npm run export
```

The script writes `migration-tools/exports/edutech-d1.private.sql` with file
permissions 0600. It exports Firebase Auth user IDs/emails, users, courses,
parent-child bundles, lectures, study progress, active enrollments, team permissions,
categories and payment orders. Existing Firebase video URLs remain YouTube;
R2 videos can be uploaded independently from the admin panel.

**The generated SQL contains private student data and video IDs. Never commit
it to GitHub, send it in chat, or publish it.** Import it into the **empty,
test D1 database** after applying both schema migrations. Test counts against
Firebase before touching production. The export uses replacement inserts and
must **not** be rerun against a live populated D1 database without a tested
idempotent migration plan.

Example:

```bash
npx wrangler d1 execute edutech-db --remote --file=migration-tools/exports/edutech-d1.private.sql
```

The example assumes you ran Wrangler from repository root and its config points
to the **correct isolated D1 database**.

### Part D — Owner access

The exporter imports `system/adminOwner.uid` when that Firebase account still
exists. Otherwise: sign in once via email OTP and then (using the **D1 dashboard SQL
editor** as the Cloudflare owner) grant the correct verified account the role:

```sql
INSERT INTO staff (user_id, role, permissions_json, active)
SELECT id, 'owner', '["*"]', 1
FROM users WHERE email = 'THE_OWNER_VERIFIED_EMAIL'
ON CONFLICT(user_id) DO UPDATE SET role='owner', permissions_json='["*"]', active=1;
```

Only grant owner to an email address you personally control and have verified.
Do not expose this SQL command as a public API.

### Part E — Test before enabling payments

Pages **server-only** variables:
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, and `PAYMENTS_ENABLED`.

Leave `PAYMENTS_ENABLED=false` for initial deployment. After testing student
login and course data, enter **test** Razorpay keys and set it to `true`.
Configure Razorpay webhook as:

```
https://YOUR-PAGES-DOMAIN/api/payments/webhook
```

Subscribe to `payment.captured`, use the matching webhook secret, and ensure
automatic payment capture. Test exact amount, order signature, webhook signature,
duplicate events, expired course enrollment and full AiOps child-course unlock.
Use test mode until everything passes. Refund/chargeback automation is not
implemented; manage these manually before production.

### Part F — Full acceptance checklist before live DNS cutover

- [ ] Public course cards, thumbnails, categories, search, prices and full syllabus
- [ ] Parent AiOps bundle purchase unlocks all included courses (including old folder-only modules)
- [ ] No student sees another student's enrollments or progress
- [ ] OTP email login works and migrated student IDs preserve purchases
- [ ] Admin owner and staff permissions are enforced server-side
- [ ] Admin creates courses/lectures, uploads private R2 video, publishes changes
- [ ] Paid video without enrollment returns 403/404; Range playback works
- [ ] YouTube lessons still play embedded on the site
- [ ] Manual studied and 90%-watch completion progress survive page reload
- [ ] Expired enrollment and free trial gating work correctly
- [ ] Razorpay test order, verification, webhook and duplicate payment handling work
- [ ] Mobile pages work; no JavaScript errors
- [ ] Backup counts match across all original and migrated collections
- [ ] Domain and DNS tested, SSL active; production payment credentials only after approval

Cloudflare account access/bindings and merchant/email provider secrets are not
available to the code author yet. This branch is not an assertion that a Cloudflare
deployment, migration or production payment test has succeeded.

## Useful docs

- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/r2/
- https://developers.cloudflare.com/turnstile/
