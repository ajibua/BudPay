# BudPay: The Fair Pay Helper

> PayPal moves the money. BudPay helps the boss decide what is fair.

BudPay helps a small business owner split a customer payment among crew members. The owner describes the work, reviews the suggested hours and skill weights, adjusts the boss share, and explicitly approves the payout. All PayPal calls are restricted to Sandbox.

## How it works

1. Create a PayPal Sandbox order and complete customer approval.
2. BudPay captures the approved order and stores the job in Supabase.
3. The owner enters a work story. Gemini extracts crew names, tasks, hours, and thank-you notes.
4. Each name must match a saved crew member. The owner reviews hours, skill weights, and the suggested split.
5. BudPay reconciles the split in whole cents and warns about unusually high hours or shares.
6. The owner presses **Approve & Send**. The backend recalculates the split, checks the saved roster and paid job, and submits one idempotent PayPal payout batch.
7. BudPay polls PayPal for each item and records each recipient's result in Supabase.

The AI does not calculate money or choose recipients. Payout emails are read from the server-side roster and are not accepted from the browser.

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

Do not use placeholder addresses. Only people in this table can receive payouts.

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

## Safety and payout behavior

- Customer payment, costs, boss share, and crew allocations use integer cents.
- The backend recalculates each crew member's cents from the saved job and submitted hours/weights before payout.
- Recipients must be active people in Supabase. The backend chooses their saved email.
- Payout requires a captured customer order and a human press of **Approve & Send**.
- Jobs move through `draft -> reviewed -> approved -> sent` and are stored durably.
- A job is atomically claimed with a stable sender batch ID and the exact payout request before contacting PayPal. Retries reuse that saved request and sender ID; PayPal processes a sender batch ID only once within 30 days. BudPay retrieves the original batch on a duplicate response. After the retry window, the job requires manual reconciliation.
- The receipt marks a person **Paid** only when PayPal reports that item's status as `SUCCESS`.
- Story, approval, payout, and status events are written to `job_events`; payout item statuses are saved in `payouts`.

## Remaining before a public demo

- Configure real Sandbox buyer and crew accounts and Supabase credentials.
- Run complete Sandbox customer-to-crew payout scenarios and confirm each recipient's account and receipt status.
- Deploy the backend and frontend with their secrets configured, record the demo, and complete hackathon submission requirements.

The app is a Sandbox hackathon prototype. It does not implement production user authentication or crew logins.

