import {Link} from "react-router-dom";
import {ArrowLeft,ExternalLink,FileText,LockKeyhole,Mail,ShieldCheck} from "lucide-react";

const CONTACT="sufiyankadival2@gmail.com";
const EFFECTIVE="29 October 2026";

function LegalLayout({title,description,kind,children}){
 return <div className="min-h-[75vh] bg-slate-50">
  <section className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 text-white">
   <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-200 hover:text-white"><ArrowLeft size={16}/> Back to InfraRivet Academy</Link>
    <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-sky-200/30 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-sky-100">{kind==="privacy"?<ShieldCheck size={16}/>:<FileText size={16}/>} Legal information</div>
    <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
    <p className="mt-5 max-w-3xl leading-8 text-slate-200">{description}</p>
    <p className="mt-6 text-sm text-slate-300">Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</p>
   </div>
  </section>
  <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
   <article className="space-y-9 rounded-3xl border border-slate-200 bg-white px-6 py-9 text-slate-700 shadow-sm sm:px-10 sm:py-12 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_li]:mb-2 [&_p]:leading-7 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:leading-7">{children}</article>
   <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
    <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-blue-800 hover:border-blue-300" to={kind==="privacy"?"/terms-of-service":"/privacy-policy"}><ExternalLink size={15}/>{kind==="privacy"?"Terms of Service":"Privacy Policy"}</Link>
    <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-blue-800 hover:border-blue-300" to="/"><ArrowLeft size={15}/>Home</Link>
   </div>
  </div>
 </div>;
}

export function PrivacyPolicy(){
 return <LegalLayout kind="privacy" title="Privacy Policy" description="Learn what information InfraRivet Academy uses to provide student accounts, courses, progress tracking, and a secure learning experience.">
  <section><h2>1. Who we are</h2><p>InfraRivet Academy ("InfraRivet", "we", "us", or "our") operates the educational website at <a className="font-semibold text-blue-700 underline" href="https://infrarivet.pages.dev">https://infrarivet.pages.dev</a>. This policy explains how personal information is handled when you browse the website, create an account, or use our learning services.</p></section>
  <section><h2>2. Information we collect</h2><ul>
   <li><strong>Account details:</strong> name, email address, and a unique identifier supplied by Google when you use Google Sign-In. We do not receive or store your Google account password.</li>
   <li><strong>Learning information:</strong> course enrollments, access rights, lesson progress, and other activity needed to provide your learning dashboard.</li>
   <li><strong>Security and technical information:</strong> session cookies, security events, and information such as IP address, device/browser details, and request logs that may be processed by our infrastructure provider.</li>
   <li><strong>Support communications:</strong> information you voluntarily include when contacting us.</li>
   <li><strong>Payment-related information:</strong> if paid checkout is enabled in the future, transaction identifiers, payment status, and enrollment information may be processed. Payment-card information is handled by the applicable payment processor rather than stored by InfraRivet Academy.</li>
  </ul></section>
  <section><h2>3. How we use information</h2><ul>
   <li>Create and authenticate student accounts, including Google Sign-In.</li>
   <li>Deliver courses, manage enrollments, and remember lesson progress.</li>
   <li>Protect accounts, prevent abuse, and maintain the reliability of the service. The classroom player may visibly watermark video playback with your signed-in account email to discourage unauthorized recording and sharing.</li>
   <li>Respond to support, privacy, and account-deletion requests.</li>
   <li>Meet legal obligations and investigate security issues when required.</li>
  </ul><p>We do not sell your personal information to advertisers.</p></section>
  <section><h2>4. Google Sign-In</h2><p>Google Sign-In is provided through Google Identity Services. When you choose it, Google authenticates your account and shares identifying information such as your name, verified email, and Google account identifier with InfraRivet Academy. We use this information only for account authentication and related student access. Google's own handling of information is governed by <a className="font-semibold text-blue-700 underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</p></section>
  <section><h2>5. Cookies and security</h2><p>We use a secure, HttpOnly session cookie to keep you signed in. It is used for authentication rather than behavioral advertising. We may use Cloudflare security services, including bot protection or verification tools where configured. You may clear your browser cookies, but doing so can sign you out.</p></section>
  <section><h2>6. Service providers and sharing</h2><p>We rely on service providers to operate the website. These can include Cloudflare for website hosting, security, and database infrastructure, Google for sign-in, and an email delivery provider if email-based login or messages are enabled. We disclose information to these providers as necessary for their services, or when legally required. Course content hosted by third-party services may be subject to their separate policies.</p></section>
  <section><h2>7. Storage, security, and retention</h2><p>Account and course records are stored using Cloudflare-hosted infrastructure. We use authentication checks and access controls designed to protect student data; however, no internet service can guarantee absolute security. We retain information while needed to run your account, deliver learning access, resolve disputes, and meet legal or security obligations. Information is deleted or anonymized when no longer required, subject to lawful retention needs.</p></section>
  <section><h2>8. Your choices and rights</h2><p>You may ask to access, correct, or delete personal information associated with your account, subject to applicable law and legitimate retention obligations. You may also stop using the service and sign out at any time. To make a request, email us using the contact details below. We may need to verify that you own the relevant account before making changes.</p></section>
  <section><h2>9. Children and international access</h2><p>The service is intended for learners who can lawfully use online educational services. If a minor uses the service, a parent or guardian should supervise where required by law. We do not knowingly seek sensitive information from children. Infrastructure or sign-in services may process data in other countries, depending on the provider's operations.</p></section>
  <section><h2>10. Changes to this policy</h2><p>We may update this Privacy Policy if our website or legal obligations change. The effective date at the top will indicate the latest published version. Material changes may be communicated through the website or another appropriate channel.</p></section>
  <section><h2>11. Contact us</h2><p>For privacy questions, access requests, or account-deletion requests, contact InfraRivet Academy at <a className="font-semibold text-blue-700 underline" href={"mailto:"+CONTACT}>{CONTACT}</a>.</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><LockKeyhole size={16}/>Never send your Google password or sign-in verification codes by email.</p></section>
 </LegalLayout>;
}

export function TermsOfService(){
 return <LegalLayout kind="terms" title="Terms of Service" description="The basic rules for using InfraRivet Academy, your learning account, and course materials. Please read these terms before using the platform.">
  <section><h2>1. Acceptance of terms</h2><p>By accessing or using InfraRivet Academy at <a className="font-semibold text-blue-700 underline" href="https://infrarivet.pages.dev">https://infrarivet.pages.dev</a>, you agree to these Terms of Service. If you do not agree, please do not use the platform. If you are a minor, a parent or guardian may need to approve your use under applicable law.</p></section>
  <section><h2>2. About the service</h2><p>InfraRivet Academy provides access to educational course listings, learning materials, student accounts, and progress-tracking features. Available courses, features, enrollments, and pricing may change over time. Some features, such as paid checkout or private video hosting, may not be available until separately launched.</p></section>
  <section><h2>3. Accounts and sign-in</h2><p>You must provide accurate account information and use an account you are authorized to access. You are responsible for activity performed through your account and for protecting access to your Google account and devices. Do not share login sessions, impersonate others, or try to access accounts or administrator features without permission. We may restrict access where needed to protect users or the service.</p></section>
  <section><h2>4. Course access and availability</h2><p>Enrollment provides access only to the courses, lessons, and period expressly described at the time of enrollment. Free, preview, trial, bundle, and paid access may have different rules. Buying one course does not automatically include unrelated courses unless the offer explicitly says so. We may update course content and schedules as part of normal service improvements.</p></section>
  <section><h2>5. Payments, cancellation, and refunds</h2><p>If paid enrollment becomes available, the applicable course page or checkout will show the price and relevant purchase terms before payment. Payments may be processed through an independent payment service. Any refunds, cancellations, and consumer rights will be handled according to the terms shown for the particular purchase and applicable law. We do not promise a specific refund period unless it is explicitly stated in the relevant offer.</p></section>
  <section><h2>6. Learning materials and intellectual property</h2><p>The website design, course structure, text, videos, downloads, and other learning materials may be protected by copyright or other rights. We grant enrolled users a limited, personal, non-transferable right to use materials for their own learning, subject to the enrollment terms. Unless permission is expressly given, do not redistribute, resell, republish, record, or publicly share protected course content.</p></section>
  <section><h2>7. Acceptable use</h2><p>You agree not to:</p><ul>
   <li>Attempt unauthorized access to the website, database, courses, or other users' accounts.</li>
   <li>Disrupt service operation, bypass enrollment controls, or abuse automated requests.</li>
   <li>Upload or share content that violates the law or other people's rights.</li>
   <li>Use lessons or tools to harm, harass, defraud, or compromise others.</li>
   <li>Misrepresent your identity or use another person's login without permission.</li>
  </ul></section>
  <section><h2>8. Educational purpose</h2><p>Courses and learning resources are provided for educational purposes. We do not guarantee exam results, certificates, employment, earnings, a specific skill outcome, or uninterrupted availability. Where possible, we aim to correct material errors and maintain useful content. Nothing here limits rights that cannot be excluded under applicable law.</p></section>
  <section><h2>9. Third-party services</h2><p>The website may rely on Google Sign-In, Cloudflare infrastructure, and third-party video, payment, or content services. Those providers may have their own terms and privacy policies. InfraRivet Academy does not control third-party websites and is not responsible for their independent content or practices, except as required by law.</p></section>
  <section><h2>10. Suspension and termination</h2><p>We may suspend or end account access where reasonably necessary for security, legal compliance, misuse, or serious violation of these terms. You may stop using the service at any time and can request account deletion. Requests involving existing enrollments or purchases will be reviewed subject to applicable consumer rights and legal requirements.</p></section>
  <section><h2>11. Limitation of liability</h2><p>We work to provide a reliable learning experience, but the service may sometimes be interrupted, updated, or unavailable. To the extent permitted by applicable law, we are not responsible for indirect or consequential losses arising from use of the platform. Nothing in these terms excludes liability or statutory consumer protections that cannot lawfully be excluded.</p></section>
  <section><h2>12. Changes and questions</h2><p>We may revise these terms as services develop. Updated terms will be posted on this page with a revised date. For questions, support, or requests relating to your account, email <a className="font-semibold text-blue-700 underline" href={"mailto:"+CONTACT}>{CONTACT}</a>.</p><p className="mt-4 text-sm text-slate-500">For information about personal data, read our <Link className="font-semibold text-blue-700 underline" to="/privacy-policy">Privacy Policy</Link>.</p></section>
 </LegalLayout>;
}
