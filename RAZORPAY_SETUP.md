# EduTech Razorpay integration setup

This integration is a one-time purchase system for 1, 3, 6 or 12 calendar months.

To enable checkout:

1. Activate your own Razorpay merchant account and obtain test API credentials.
2. Publish the updated firestore.rules in Firebase Console, and test that expired enrollments cannot access lectures.
3. Configure these server-only variables in Vercel Project Settings, Environment Variables:
   - RAZORPAY_KEY_ID
   - RAZORPAY_KEY_SECRET
   - RAZORPAY_WEBHOOK_SECRET
   - FIREBASE_SERVICE_ACCOUNT_JSON
   - PAYMENTS_RULES_CONFIRMED (set to true ONLY after publishing Firestore rules)
4. Alternatively to FIREBASE_SERVICE_ACCOUNT_JSON, configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
5. In Razorpay Dashboard configure automatic payment capture and a webhook subscribed to payment.captured. The webhook URL is https://edutech-in.vercel.app/api/payments/webhook and its secret must match RAZORPAY_WEBHOOK_SECRET.
6. Redeploy Vercel so new variables load.
7. In EduTech Admin, edit the main DevOps course and enter 1, 3, 6 and 12 month INR prices. Zero disables a plan.
8. Test a complete purchase with Razorpay test keys, and confirm student access, expiry, and renewals before switching to live credentials.

Server creates orders from trusted Firestore prices, checks Razorpay checkout signatures and captured status, and verifies signed raw webhooks. An atomic Firestore transaction records each payment exactly once and grants enrollment. The browser never creates enrollments.

Older administrator-created access without expiration remains valid for compatibility. Live payment onboarding and KYC remain Razorpay requirements.

Refund and chargeback handling must currently be managed by the admin; automated revocation is not implemented.
Never put server credentials in frontend variables, committed files, or chat.
