# BudPay: Services Marketplace & Fair Pay

BudPay connects customers with service agencies and gives each agency a workspace to manage jobs, crew contributions, and fair payouts. Customers can book as guests. Agency owners and crew use Supabase Auth. PayPal is restricted to Sandbox.

## The app from start to finish

### 1. Customers discover and book a service

The landing page explains BudPay. Customers can browse the public Agencies directory, read each agency story and see its agency-submitted portfolio, then browse services in the Marketplace. Customers do not need a BudPay account.

At checkout, a customer enters their name, email, and optional request. BudPay creates a PayPal Sandbox order for the selected service. The customer approves it in PayPal and returns to BudPay. BudPay verifies and captures the order, saves the paid booking under the selected agency, and shows a booking reference. Customers can use that reference and their checkout email to track the booking.

Agencies can publish services and update their public profile and portfolio from their workspace. Portfolio photos and descriptions are supplied by the agency.

### 2. Agencies manage their own work

An agency owner signs in and creates or opens the agency workspace. Each agency has its own services, profile, crew roster, work logs, bookings, and payout records.

The boss sees the agency's bookings in Agency Jobs & Payouts and can move a paid booking through in progress and completed. For a marketplace booking, the split workflow reuses the existing customer payment; it does not create a second customer charge.

Crew members sign in and submit their own work-hour claims. They can view their own claims, but cannot open the boss workspace or other crew records. The boss reviews claims and runs the fair-pay workflow.

### 3. AI helps turn the work story into a reviewable crew list

The boss types or dictates a plain-language account of who did what and for how long. Google Gemini returns structured crew names, tasks, hours, suggested skill weights, summaries, and thank-you note drafts. If Gemini is unavailable, BudPay uses its deterministic parser and labels the result so the boss knows to review it.

AI does not decide who gets paid or calculate money. The boss must match each person to the agency roster and review the extracted details. Missing hours or task information is flagged for clarification.

### 4. BudPay calculates and validates the split

The boss enters customer payment, material costs, and the boss's share. BudPay calculates the remaining crew pool and allocates it using each crew member's hours and skill weight. Money calculations use integer cents, reconcile to the exact total, and run server-side guardrails. The boss can adjust the proposed amounts before submitting anything.

For a direct agency job, Step 1 can create a PayPal Sandbox order. BudPay returns the boss to the same Split page after PayPal checkout. The boss can open the approval page again or confirm the payment. Confirming captures the approved order and unlocks Continue to Step 2. The boss then reviews the story, allocations, and final split.

### 5. The boss approves PayPal payouts

The boss presses **Approve & Send** only after reviewing the split. The backend recalculates the allocations, validates the paid job and roster, stores an idempotent payout request, and submits a PayPal Sandbox Payouts batch to the crew recipients' Sandbox emails. BudPay checks PayPal's batch and item statuses and records them in the agency history. A crew member is shown as paid only when PayPal reports the item as successful.

## How PayPal is used

BudPay uses PayPal Orders to create and capture customer payments, and PayPal Payouts to send the boss-approved crew allocations. A PayPal order is not captured until the buyer approves it and BudPay confirms the payment. Payouts are a separate, explicit boss action.

There are two Sandbox payment modes:

- **Configured merchant mode:** payments use the PayPal Sandbox merchant associated with the backend app credentials.
- **Connected-agency mode:** when the platform's PayPal partner settings are configured, each agency connects its own Sandbox seller account. Marketplace orders name that agency as the payee, and crew payouts use the same seller context.

BudPay does not hold customer funds in escrow. The Agency Jobs payment card shows BudPay-recorded payment and payout totals; it is not a live PayPal balance or a withdrawable wallet.

The backend rejects PayPal API hosts outside **https://api-m.sandbox.paypal.com**. Use only Sandbox credentials and accounts.

## How AI is used

BudPay uses Google Gemini to help an agency boss turn a written or dictated description of completed work into structured information for the fair-pay workflow. The AI can identify crew names, tasks, hours, and suggested skill weights, and draft a job summary and thank-you notes. Voice input is converted to text by the browser before the description is sent for parsing.

The backend asks Gemini for structured output. If Gemini is unavailable, BudPay falls back to a deterministic parser. In either case, the result is a draft: the boss reviews it, resolves missing details, and matches each person to the agency's crew roster before continuing.

Gemini does not select payout recipients, set final payout amounts, approve a job, or send money. BudPay's backend validates the roster and job, calculates the split in whole cents, and checks that the amounts reconcile. The boss reviews and explicitly approves the PayPal payout.

## Sign-in and access

Supabase Auth supports Google OAuth and email/password accounts. Signup confirmation and password recovery use the Supabase email configuration. Authentication callbacks exchange Supabase PKCE codes using server-side cookies.

- **Agency boss:** manages only their agency's services, profile, crew, jobs, work logs, and payout history.
- **Crew:** submits and views only their own work logs.
- **Customer:** browses, books, pays, and checks a booking as a guest.

The backend verifies the Supabase session and enforces roles and agency boundaries on protected API requests. **BUDPAY_OWNER_EMAIL** is a one-time bootstrap for claiming the existing Tunde Studio workspace; new agency owners create their own workspaces.

Demo url: https://bud-pay-6i61.vercel.app
License: MIT License.
## Main screens

- **/** — BudPay overview and customer/agency story
- **/agencies** — public agency directory
- **/marketplace** — service discovery, guest checkout, and FAQs
- **/booking** — guest booking lookup
- **/login** — Google and email/password sign-in or account creation
- **/agency/setup** — create an agency workspace for a new owner
- **/agency** — agency profile and portfolio management
- **/split** — customer payment, story parsing, fair allocation, and payout workflow
- **/history** — agency jobs, payment records, PayPal connection, and payout statuses
- **/roster** — agency crew roster
- **/hours** — crew work-hour submissions and claim history
- **/how-it-works** — fair-pay workflow explanation

## Technology and data

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend:** Express and Node.js ES modules
- **Authentication and database:** Supabase Auth, PostgreSQL, and Supabase REST API
- **AI:** Google Gemini structured story parsing with a deterministic fallback
- **Payments:** PayPal Sandbox Orders and Payouts APIs
- **Portfolio images:** public Supabase Storage bucket named **agency-portfolio**

The complete database setup is in [Backend/schema.sql](Backend/schema.sql). Run the entire file in the Supabase SQL Editor. It creates the agency-scoped tables and storage bucket, preserves the Tunde Studio workspace, and seeds its profile and example services. Running only the final grants or RLS statements will fail because the tables must exist first.

## Run locally

### 1. Configure Supabase

Run the full **Backend/schema.sql** file in Supabase.

In Supabase Auth URL Configuration, set the Site URL to the frontend's deployed origin and allow the local and deployed app callback URLs:

- **http://localhost:3000/auth/callback**
- **http://localhost:3000/auth/recovery**
- **https://YOUR-FRONTEND-DOMAIN/auth/callback**
- **https://YOUR-FRONTEND-DOMAIN/auth/recovery**

Enable Google in Supabase Auth and use the Supabase provider callback URL shown in its Google setup instructions as the authorized redirect URI in Google Cloud. Configure the email provider and SMTP in Supabase if using email confirmation or password recovery.

### 2. Configure the backend

Copy **Backend/.env.example** to **Backend/.env** and set the values for the Sandbox and Supabase projects:

    PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
    PAYPAL_CLIENT_ID=
    PAYPAL_CLIENT_SECRET=
    PAYPAL_RETURN_URL=http://localhost:3000
    GEMINI_API_KEY=
    SUPABASE_URL=
    SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_ROLE_KEY=
    BUDPAY_OWNER_EMAIL=

The two **PAYPAL_PARTNER_...** values enable connected-agency routing when available. Keep the PayPal secret and Supabase service-role key on the backend only. **BUDPAY_OWNER_EMAIL** is only for claiming the existing Tunde Studio workspace. **BUDPAY_AGENCY_NAME** can optionally change its display name.

Start the backend:

    cd Backend
    npm install
    npm run dev

### 3. Configure and start the frontend

Copy **Frontend/.env.local.example** to **Frontend/.env.local** and set:

    NEXT_PUBLIC_API_URL=http://localhost:5000
    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=

The frontend can use **NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY** instead of the anon key. Start the frontend in a second terminal:

    cd Frontend
    npm install
    npm run dev

Open **http://localhost:3000**. Use a PayPal Sandbox Personal account as the customer and Sandbox Business account(s) as the seller. Use Sandbox recipient emails for crew payouts.

## Important behavior

- Customer payments and crew payouts are separate PayPal transactions.
- Marketplace bookings are public; customer sign-in is not required.
- Marketplace service, profile, job, crew, and payout records are associated with an agency.
- Payouts require an explicit boss approval; crew hours alone do not trigger payment.
- Portfolio examples are supplied by the agency.
