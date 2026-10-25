# EduTech development setup

This is an early application foundation, **not a production-ready learning platform**. Checkout `develop`.

1. Install Node.js 20+ and run `npm install`.
2. Create a Firebase project, enable Email/Password Authentication and Cloud Firestore.
3. Copy `.env.example` to `.env` and fill in your Firebase web app configuration.
4. Run `npm run dev` for local development or `npm run build` to produce `dist`.
5. Install Firebase CLI, sign in and associate your project before deploying rules or hosting. Review security rules first.

Missing features include signup, role management, enrollments, video lessons, admin CMS, Razorpay checkout, certificate issuance, and the remaining pages. Never commit Firebase service account keys or Razorpay secrets.
