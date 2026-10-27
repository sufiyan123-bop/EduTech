# InfraRivet Academy — Cloudflare staging implementation

React + Vite + Tailwind course website with Cloudflare Pages Functions, D1 and private R2.

- Master course → included courses → chapters → lectures
- Private video player (Cloudflare R2 or embedded YouTube)
- Student email-OTP sign-in, lesson ticks and progress
- Admin course, chapter, lecture, enrollment, free-trial and staff management
- Razorpay verified checkout and webhook, **disabled until configured**

This branch is **not live on Cloudflare yet** and has an empty cloud database until
you provision resources and import your existing Firestore/Auth data.

### Setup

See [CLOUDFLARE_MIGRATION.md](./CLOUDFLARE_MIGRATION.md) for the full account,
Cloudflare Pages, D1, R2, Turnstile, email and payment checklist, plus data safety.

```bash
npm install
npm test
npm run build
```

Do not deploy to an existing production domain, delete Firebase, or enable real
payments until the migration checklist and end-to-end tests pass.

The original `main` branch remains available as the current live site's rollback.
