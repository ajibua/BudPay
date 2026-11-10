# BudPay: Services Marketplace & Fair Pay

> Customers find and pay service teams. Agencies use BudPay to share earnings fairly.

BudPay is growing from an agency fair-pay workspace into a services marketplace. Customers browse a service, book it, and pay through PayPal. The agency receives the paid booking in its workspace, coordinates the work, reviews crew contributions, and explicitly approves a fair payout. All PayPal calls are restricted to Sandbox.

## Project handoff for the next agent

### What BudPay is

BudPay is a two-sided services marketplace with a private workspace for each agency. Customers browse agencies and services, book as guests, and pay with PayPal Sandbox. An agency manages its own bookings, crew, work logs, and fair-pay decisions. Customers do not get access to agency operations or crew records.

### Current implementation

| Area | Implemented | State / important context |
| --- | --- | --- |
| Marketplace | Public agencies directory, agency profiles and agency-submitted portfolio, service listing and creation, guest booking, booking lookup, FAQ accordions | Portfolio examples are not independently verified. |
| Authentication | Supabase Auth with Google OAuth and email/password UI; callback and role-aware workspace routing. Password recovery now exchanges its PKCE code at `/auth/recovery` before showing the reset form. | Google sign-in has worked in the demo setup. Email confirmation and password reset depend on Supabase SMTP delivery and still need an end-to-end check. Add local and deployed `/auth/recovery` URLs to Supabase Auth's redirect allowlist. |
| Agency separation | Each company gets its own workspace, roster, jobs, work logs, and payout history | Backend scopes agency operations by `agency_id`. `BUDPAY_OWNER_EMAIL` only bootstraps the existing `tundestudio` workspace; it is not the way to authorize every future agency. |
| RBAC | Agency boss can manage the agency workspace. Crew can submit and view their own hours only. Public customers can browse/book without signing in. | Crew hours are not automatically included in a payout; the boss reviews job details and approves the split. |
| Fair sharing | Gemini parses the boss's work story; server-side rules calculate and validate cents, then the boss reviews the result | Gemini does not choose recipients or calculate money. Payout is an explicit boss action. |
| PayPal Sandbox | Existing single-merchant order/capture and payout path; optional connected-agency seller onboarding, payee routing, and agency-context crew payouts | Connected-seller code is implemented but has not yet been confirmed end to end against an enabled PayPal partner Sandbox app. Partner credentials and PayPal-side enablement are required. No escrow or live PayPal support. |
| Agency wallet view | Agency Jobs shows recorded captured-payment and submitted crew-payout totals for the connected seller | These are BudPay ledger totals, not a live PayPal balance or withdrawable wallet. |
| Visual/product work | Navbar simplified, Google sign-in icon added, local Geist fonts self-hosted, landing/marketplace storytelling and FAQ section added | Recheck the deployed build during demo preparation. |

### Immediate next work

1. **Finish connected-seller Sandbox verification.** Confirm the PayPal app/platform is enabled for multiparty partner testing. Set backend `PAYPAL_PARTNER_MERCHANT_ID` and `PAYPAL_PARTNER_ATTRIBUTION_ID`, run the full latest [`Backend/schema.sql`](Backend/schema.sql), restart/redeploy, connect a distinct Sandbox business seller for an agency, then test guest booking, capture to that seller, and a boss-approved crew payout from that same seller context. Confirm PayPal status and agency ledger totals. If PayPal rejects onboarding, permissions, capture, or payouts, inspect its response/debug ID and resolve partner-app capability before changing the business flow. Never put credentials in chat or frontend variables.
2. **Make auth email flows reliable.** Verify signup confirmation, resend confirmation, password reset, and callback behavior locally and on the deployed domain. Check Supabase Site URL / redirect allowlist and configured SMTP. Keep email confirmation behavior consistent with Supabase; do not make accounts trusted merely because signup returned successfully.
3. **Add customer trust features.** Add feedback tied to a completed booking, then decide what agency identity verification means and how its evidence/status is shown. Portfolio images are currently self-submitted and must not be presented as verified reviews.
4. **Add customer communication.** Implement email receipts/progress updates and agency-customer messaging after the payment/identity work is stable.
5. **Prepare the demo.** Run customer-to-agency-to-crew scenarios with Sandbox accounts, check the deployed frontend/backend configuration, and complete the hackathon submission/demo requirements.

### Payment model and guardrails

- With connected-agency routing configured, the marketplace order names the agency's PayPal seller as the payee and requests instant disbursement. BudPay records the seller ID on the job so capture and later payouts use the same agency context.
- The agency remains responsible for its job and crew decisions. The boss reviews and approves the split; BudPay then submits a PayPal Payouts batch. A customer capture is not automatically divided among crew.
- Connected seller booking is blocked until PayPal seller eligibility and required crew payout permission are confirmed.
- If partner settings are absent, the legacy single configured Sandbox merchant path remains available for existing demo behavior. Do not interpret that fallback as multi-agency funds separation.
- All PayPal API calls are guarded to `https://api-m.sandbox.paypal.com`. Do not add live PayPal credentials or describe this prototype as supporting live payments, escrow, or a live wallet.
- Payout requests are durably claimed with a stable sender batch ID and exact request before contacting PayPal, so retries can recover the original batch. Keep this idempotency behavior intact when editing payout code.

### Useful code map

| Path | Responsibility |
| --- | --- |
| `Frontend/src/app/marketplace/page.tsx` | Customer service discovery, booking, and marketplace FAQs |
| `Frontend/src/app/agencies/` and `Frontend/src/app/agency/` | Agency directory, public profile/portfolio, workspace setup, and PayPal return page |
| `Frontend/src/app/history/page.tsx` | Agency Jobs, payout history, connected seller status, and recorded payment totals |
| `Frontend/src/app/login/page.tsx`, `Frontend/src/app/auth/`, `Frontend/src/app/reset-password/page.tsx`, `Frontend/src/components/AuthProvider.tsx` | Supabase sign-in/callback, PKCE password recovery, session state, and frontend route guards |
| `Backend/src/server.js` | API routes, Supabase identity verification, role checks, agency scoping, booking/payment/payout orchestration |
| `Backend/src/services/paypal.js` | Sandbox-only PayPal Orders, seller onboarding/verification, capture, and Payouts calls |
| `Backend/src/services/db.js` | Supabase persistence and mapping for agencies, services, jobs, work logs, and payout history |
| `Backend/src/services/mathEngine.js` | Deterministic fair-share calculation and payout guardrails |
| `Backend/schema.sql` | Full database setup and additive columns for agency and seller routing |

When taking over, read this handoff and the relevant route/service before editing. **This checkout currently has uncommitted connected-seller work** in the backend PayPal service/routes/database mapping/schema, the Agency Jobs screen, the PayPal return page, and this README. Check `git status` and preserve/review those changes before making edits or resetting anything. Do not treat connected-seller Sandbox routing as verified until its complete payment-and-payout path has been exercised with PayPal partner Sandbox access.

## Product direction and current MVP

The customer side is for finding an agency and paying for its service. The agency side is for managing the paid job, crew work, and the final split. Customers do not see internal crew logs or payout decisions.

The public **Agencies** directory introduces the companies on BudPay; the **Marketplace** focuses on comparing and booking their services. A customer can view each agency profile and its agency-submitted portfolio, book a service, and pay through PayPal Sandbox. Agency owners sign in and create a workspace; each workspace has its own boss, crew roster, work logs, jobs, and payout history. Boss and crew APIs are scoped to that agency. The profile owner can edit its story and portfolio; portfolio uploads accept JPEG, PNG, or WebP images up to 2 MB in the public Supabase Storage bucket `agency-portfolio`. Customers enter contact details and an optional request, approve a Sandbox order, and return to BudPay for capture and a booking reference. The selected agency sees its paid booking in its workspace and can prepare the crew split from that existing capture.

Marketplace seller routing is available as an optional PayPal Sandbox partner flow. When connected-seller settings are configured, each agency connects its own Sandbox PayPal seller account; BudPay routes booking payments to that seller and submits later crew payouts in the same seller context. Without those partner settings, the existing single configured Sandbox merchant flow remains active. BudPay does not hold funds in escrow. `BUDPAY_OWNER_EMAIL` remains only as a one-time bootstrap for claiming the existing `tundestudio` workspace; new agencies use their own confirmed Supabase account. Set optional `BUDPAY_AGENCY_NAME` to override the legacy demo agency's display name. Email receipts, customer feedback tied to completed bookings, and identity checks remain later milestones.

**Next build milestones:** add customer feedback tied to completed bookings, then consider stronger agency identity checks and customer account protections; add email receipts and customer-to-agency messaging. Portfolio entries are agency-submitted examples, not independently verified work or customer reviews.

## How it works

1. A customer selects a service and provides contact details and an optional request.
2. BudPay creates a fixed-price PayPal Sandbox order. After customer approval, PayPal returns the customer to BudPay, which verifies and captures payment before showing the booking reference.
3. A guest can later check the booking using its reference and the email entered at checkout. The agency moves the service progress through paid, in progress, and completed in **Agency Jobs & Payouts**.
4. The agency opens a paid booking to prepare the team split. The existing payment capture is reused.
5. The owner types or dictates the work story. Dictation appears as editable text; Gemini extracts crew names, tasks, hours, and thank-you notes.
6. Each name must match a saved crew member. The owner reviews hours, skill weights, and the suggested split. After a work type appears in three fully successful payout jobs, its starting skill weight reflects the boss's historical choices.
7. BudPay reconciles the split in whole cents and warns about unusually high hours or shares.
8. The owner presses **Approve & Send**. The backend recalculates the split, checks the saved roster and paid job, and submits one idempotent PayPal payout batch.
9. BudPay polls PayPal for each item and records each recipient's result in Supabase.

## Supabase setup for agency profile and portfolio

Run the complete `Backend/schema.sql` in the Supabase SQL Editor. It creates the agency registry and agency-scoped data fields, preserves existing BudPay records under `tundestudio`, seeds its profile and services, and creates the public `agency-portfolio` Storage bucket. The backend service role handles uploads and database changes; do not put the service role key in frontend environment variables. Public visitors can read portfolio images because the bucket is public. Portfolio photos are agency-provided examples and are not independently verified.

The AI does not calculate money or choose recipients. A roster selection uses its server-side email; otherwise, the owner can enter a verified Sandbox email directly.

Voice typing uses the browser's speech recognition support and microphone permission. Browser support varies, and some browsers process speech through an online recognition service; typing remains available as a fallback.

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: Express, Node.js ES modules
- AI: Google Gemini structured story parsing
- Payments: PayPal Sandbox Orders and Payouts APIs
- Storage: Supabase REST API and PostgreSQL

## Setup

### 1. Prepare Supabase

Open the Supabase SQL editor and run the **entire** [`Backend/schema.sql`](Backend/schema.sql) file from its first line. It creates `public.marketplace_services` before enabling its row-level security; executing only the final RLS/grant statements will produce a missing-relation error. Add each crew member with their actual PayPal Sandbox personal-account email, for example:

```sql
INSERT INTO people (agency_id, name, role, email, auth_email, default_job_weight)
VALUES ('tundestudio', 'Tola', 'Apprentice / Sewing', 'the-real-sandbox-email@example.com', 'the-login-email@example.com', 1.5);
```

For a new agency, sign in with its confirmed Supabase account and follow the workspace setup prompt. Add its crew from the in-app roster so each member is assigned to the right agency. The first login with the legacy `BUDPAY_OWNER_EMAIL` claims the existing Tunde Studio workspace.

The roster is optional for payouts: saved entries can prefill a recipient, or you can enter a verified PayPal Sandbox email directly in the split screen. PayPal's item status confirms whether each address received its payout.

### 2. Configure and start the backend

Copy `Backend/.env.example` to `Backend/.env` and fill in:

- PayPal **Sandbox** client ID and secret
- Gemini API key
- Supabase project URL and **service role** key
- The frontend origin in `PAYPAL_RETURN_URL` (`http://localhost:3000` locally, and the deployed frontend origin in Vercel)

To test connected agency seller accounts, the PayPal app must be enabled for the platform / multiparty Sandbox flow. Also set `PAYPAL_PARTNER_MERCHANT_ID` to the platform Sandbox business account's merchant ID and `PAYPAL_PARTNER_ATTRIBUTION_ID` to the PayPal-issued BN code. Then run the latest complete `Backend/schema.sql` so agencies can store connected seller IDs and payout permission. An agency boss can connect its Sandbox seller account from **Agency Jobs**. Marketplace bookings stay blocked for an agency until PayPal confirms the seller is eligible and has granted the requested crew payout permission. PayPal may return an authorization error until the platform integration is enabled for partner testing.

Keep the Supabase service role key in the backend only. The backend refuses checkout and payouts when Supabase persistence is not configured. It also exits if the PayPal API URL is not a Sandbox host.

Then run:

```bash
cd Backend
npm install
npm run dev
```

### 3. Start the frontend

Copy `Frontend/.env.local.example` to `Frontend/.env.local`, set `NEXT_PUBLIC_API_URL` to the backend URL, and run:

```bash
cd Frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Browse the marketplace, book a service, and approve its PayPal order with a Sandbox buyer. PayPal returns to BudPay, which confirms payment and displays a booking reference. Use **Track a booking** with that reference and the checkout email to view progress. Each agency owner signs in to update progress and prepare team splits for their own bookings; crew members sign in to log their own hours. The existing internal fair-share wizard remains available for direct agency jobs too.

## Deploy the frontend and backend separately on Vercel

This repository contains two independent Vercel projects. Import the same Git repository twice and set each project's **Root Directory** as shown below. Each app's `vercel.json` declares its framework (`nextjs` or `express`); Vercel deploys the Express app as a Vercel Function.

Before deploying, run the latest [`Backend/schema.sql`](Backend/schema.sql) in the Supabase SQL editor. It includes the grants required by the backend and allows payout rows for recipients entered directly without selecting a saved roster person.

### 1. Deploy the backend

Create a Vercel project from this Git repository with:

- **Project name:** `budpay-backend` (or your preferred name)
- **Root Directory:** `Backend`
- **Framework preset:** Express (or leave automatic detection enabled)
- **Build command:** leave the default
- **Output directory:** leave the default
- **Install command:** leave the default (`npm install`)

Add these in **Settings → Environment Variables** for Production and Preview as appropriate. Keep the PayPal and Supabase credentials server-side; do not add them to the frontend project or any `NEXT_PUBLIC_` variable.

| Variable | Value |
| --- | --- |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox app secret |
| `PAYPAL_PARTNER_MERCHANT_ID` | Platform PayPal Sandbox business merchant ID (connected sellers) |
| `PAYPAL_PARTNER_ATTRIBUTION_ID` | PayPal-issued partner / BN attribution code |
| `PAYPAL_RETURN_URL` | Frontend's Vercel URL, added after the frontend is deployed |
| `GEMINI_API_KEY` | Google AI API key |
| `BUDPAY_AGENCY_NAME` | Optional display-name override for the legacy Tunde Studio workspace |
| `SUPABASE_URL` | Supabase project URL, such as `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

Do not set `PORT`; Vercel provides the function runtime. Deploy the backend and copy its production URL, such as `https://budpay-backend.vercel.app`. Check `https://<backend-domain>/api/health`; it should report `persistentStorage: true` and `storageMode: "supabase"`.

### 2. Deploy the frontend

Create a second Vercel project from the same Git repository with:

- **Project name:** `budpay-frontend` (or your preferred name)
- **Root Directory:** `Frontend`
- **Framework preset:** Next.js (automatic detection)
- **Build command:** leave the default (`next build`)
- **Output directory:** leave the default
- **Install command:** leave the default (`npm install`)

Set this environment variable for Production and Preview:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend's production URL, e.g. `https://budpay-backend.vercel.app` |

Redeploy the frontend after changing this value; Next.js embeds `NEXT_PUBLIC_` values during the build. Copy the frontend's production URL when it deploys.

### 3. Finish the PayPal return URL and verify

In the backend project's environment variables, set `PAYPAL_RETURN_URL` to the frontend's production origin (for example, `https://budpay-frontend.vercel.app`, with no trailing slash), then redeploy the backend. For Preview deployments, use the frontend Preview URL if you want PayPal Sandbox approval to return to that preview.

Then check:

1. `https://<backend-domain>/api/health` reports Supabase persistence is enabled.
2. `https://<backend-domain>/api/people` returns the saved roster.
3. The frontend loads its presets and roster without a browser network/CORS error.
4. Run an end-to-end customer checkout, guest booking lookup, agency progress update, and payout using Sandbox accounts only, and confirm each payout item status in the app.

Vercel environment variable changes take effect after redeployment. Keep `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, and `GEMINI_API_KEY` only in the backend project. Public marketplace browsing and booking do not require a customer account. Each agency owner and crew member signs in through Supabase Auth and is authorized only for the workspace they own or belong to; `BUDPAY_OWNER_EMAIL` is only for bootstrapping the existing demo workspace. Treat this as a Sandbox demo and do not use live PayPal credentials.

## Safety and payout behavior

- Customer payment, costs, boss share, and crew allocations use integer cents.
- The backend recalculates each crew member's cents from the saved job and submitted hours/weights before payout.
- Roster selections use the active person's saved email. Directly entered Sandbox emails are validated by the backend and sent as entered.
- Payout requires a captured customer order and a human press of **Approve & Send**.
- Jobs move through `draft -> reviewed -> approved -> sent` and are stored durably.
- A job is atomically claimed with a stable sender batch ID and the exact payout request before contacting PayPal. Retries reuse that saved request and sender ID; PayPal processes a sender batch ID only once within 30 days. BudPay retrieves the original batch on a duplicate response. After the retry window, the job requires manual reconciliation.
- The receipt marks a person **Paid** only when PayPal reports that item's status as `SUCCESS`.
- Story, approval, payout, and status events are written to `job_events`; payout item statuses are saved in `payouts`.

## Remaining before a public demo

- Configure real Sandbox buyer and crew accounts and Supabase credentials.
- Run complete Sandbox customer-to-crew payout scenarios and confirm each recipient's account and receipt status.
- Deploy the backend and frontend with their secrets configured, record the demo, and complete hackathon submission requirements.

The app is a Sandbox hackathon prototype. Supabase Auth identifies each agency owner and active crew member. A boss has full access to their agency workspace; crew accounts can submit and view only their own work-hour claims. Agency data is scoped by `agency_id` in the backend. The boss reviews claims. This RBAC setup does not automatically include approved crew hours in payout calculations.

