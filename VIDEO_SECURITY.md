# InfraRivet Academy — video security and remaining limits

This app runs on Cloudflare Pages + D1. The paid-video storage binding `VIDEOS` (private Cloudflare R2) is currently **not configured**. Do not tell anyone that videos are theft-proof or DRM-protected. This change does not enable R2, Stream, paid billing, Firebase, or Vercel.

## Protections implemented

- Every request to `/api/watch/:courseId/:lectureId` and `/api/stream/:courseId/:lectureId` checks the student's authenticated, HTTP-only cookie and server-side lesson entitlement. Revoked or expired access is rejected on subsequent requests.
- The private R2 stream API uses `Cache-Control: private, no-store`, `Vary: Cookie`, `Cross-Origin-Resource-Policy: same-origin`, `Content-Disposition: inline`, `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`. These headers override any unsafe metadata stored with the video.
- The player requests `controlsList="nodownload noremoteplayback noplaybackrate"`, disables picture-in-picture / remote playback where browsers support these attributes, and blocks the native right-click menu on the academy's player element. Browser controls are deterrents only.
- A visible moving watermark displays the authenticated student's email and a timestamp over lessons, discouraging distribution of screen recordings. This is not a forensic watermark and is removable with client-side tampering. Privacy Policy discloses email watermarking.
- The admin interface and backend reject public/unlisted YouTube IDs for paid lessons and for children of paid bundles, including when changing a course from free to paid. A YouTube ID can be shared and viewed outside the Academy, so it cannot enforce a paywall.
- Public pages get clickjacking/security headers; API JSON gets defensive response headers. Google Sign-In and CSP-related browser compatibility should be retested after deployment.

## Important limits

- **A browser must receive video bytes to play them.** An authorized user with technical knowledge can intercept an R2 media response even if right-click and the download button are disabled. Client-side watermarks can be cropped or removed. Screen recordings, external camera recordings, and analog capture cannot be made impossible.
- Do not publish originals in public repositories, public Cloudflare Pages assets, public R2 buckets, public YouTube uploads, or publicly shared cloud-drive links. Do not put private MP4 URLs in course metadata or API JSON.
- Private R2 requires an owner-created/configured bucket and billing requirements if any. R2 + authenticated streaming still does **not** provide DRM.
- For stronger paid video delivery when budget/consent permits, consider Cloudflare Stream with `requireSignedURLs: true` and expiring playback tokens; Cloudflare signed URLs prevent anonymous playback, but they **do not eliminate screen recording**. For commercial DRM (Widevine / FairPlay), choose a provider that explicitly offers supported DRM and native protected playback. Confirm availability and pricing before purchasing.
- Advise the admin to enable Google 2-Step Verification / passkeys, restrict staff permissions, maintain backups, and immediately revoke suspicious enrollment or sessions.
- To validate production after deploy: check that logged-out stream requests return 401; a paid YouTube video is rejected; the classroom watermark appears; Chrome/Android Google Sign-In and YouTube playback remain usable; headers are present on HTML and video responses.
