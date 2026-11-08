# BudPay: The Fair Pay Helper

> PayPal moves the money. BudPay helps the boss decide what is fair.

BudPay helps a small business owner split a customer payment among crew members. The owner describes the work, reviews the suggested hours and skill weights, adjusts the boss share, and explicitly approves the payout. All PayPal calls are restricted to Sandbox.

## How it works

1. Create a PayPal Sandbox order and complete customer approval.
2. BudPay captures the approved order and stores the job in Supabase.
3. The owner types or dictates a work story. Dictation appears as editable text; Gemini extracts crew names, tasks, hours, and thank-you notes.
4. Each name must match a saved crew member. The owner reviews hours, skill weights, and the suggested split. After a work type appears in three fully successful payout jobs, its starting skill weight reflects the boss's historical choices.
5. BudPay reconciles the split in whole cents and warns about unusually high hours or shares.
6. The owner presses **Approve & Send**. The backend recalculates the split, checks the saved roster and paid job, and submits one idempotent PayPal payout batch.
7. BudPay polls PayPal for each item and records each recipient's result in Supabase.

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

Open the Supabase SQL editor and run [`Backend/schema.sql`](Backend/schema.sql). Add each crew member with their actual PayPal Sandbox personal-account email, for example:

```sql
INSERT INTO people (name, role, email, default_job_weight)
VALUES ('Tola', 'Apprentice / Sewing', 'the-real-sandbox-email@example.com', 1.5);
```

The roster is optional for payouts: saved entries can prefill a recipient, or you can enter a verified PayPal Sandbox email directly in the split screen. PayPal's item status confirms whether each address received its payout.

### 2. Configure and start the backend

Copy `Backend/.env.example` to `Backend/.env` and fill in:

- PayPal **Sandbox** client ID and secret
- Gemini API key
- Supabase project URL and **service role** key
- The frontend origin in `PAYPAL_RETURN_URL`

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

Open [http://localhost:3000](http://localhost:3000). Create an order, open its PayPal approval link, approve it with a Sandbox buyer, then return to BudPay and click **I approved it — confirm customer payment**. The rest of the wizard stays locked until PayPal confirms capture.

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
| `PAYPAL_RETURN_URL` | Frontend's Vercel URL, added after the frontend is deployed |
| `GEMINI_API_KEY` | Google AI API key |
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
4. Run an end-to-end customer checkout and payout using Sandbox accounts only, and confirm each payout item status in the app.

Vercel environment variable changes take effect after redeployment. Keep `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, and `GEMINI_API_KEY` only in the backend project. This prototype does not implement user authentication, so treat the deployed app as a Sandbox demo and do not use live PayPal credentials.

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

The app is a Sandbox hackathon prototype. Supabase Auth identifies the boss and active crew members. The boss has full workspace access; crew accounts can submit and view only their own work-hour claims. The boss reviews all claims. This RBAC setup does not automatically include approved crew hours in payout calculations.

