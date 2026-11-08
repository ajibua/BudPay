This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Boss authentication setup

BudPay uses Supabase Auth for email/password and Google sign-in. The frontend sends the Supabase access token to the separate backend, and the backend verifies it with Supabase Auth on every protected request. The confirmed email in `BUDPAY_OWNER_EMAIL` is the boss and has full workspace access. A confirmed email matching an active roster member is a crew account; crew can submit and view only their own work-hour claims. The boss can view and approve or reject all claims. The backend also uses the existing service-role key for database access, so keep that secret on the backend only.

### Local settings

Copy `Frontend/env.example` to `Frontend/.env.local` and set the Supabase project URL, its public anon or publishable key, and the local backend URL. The app builds the `/auth/callback` URL from the current site origin, so it uses localhost locally and the deployed domain after deployment. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `BUDPAY_OWNER_EMAIL` in `Backend/.env` alongside the existing `SUPABASE_SERVICE_ROLE_KEY` and payment settings. `BUDPAY_OWNER_EMAIL` must be the same confirmed email used by the boss.

### Crew accounts and work-hour claims

Run the latest `Backend/schema.sql` in Supabase; it adds the crew sign-in email field and creates the `work_logs` table. Add a crew member to the boss's active roster before they sign up, and set **Crew sign-in email** to their confirmed Supabase Auth email. It can differ from their PayPal payout email; leaving it blank uses the PayPal email. They can then use the same sign-in page and are routed to **Log hours**. Every entry is a claim with a task, date, hours, and optional details. Only the boss can approve or reject it. Crew accounts cannot access the roster, payout history, AI, checkout, or payout routes. Approved claims are not sent as payouts automatically; the boss remains responsible for the reviewed fair-share flow.

### Supabase and Google settings

In Supabase Authentication settings, enable email signups and email confirmation. In the Google provider settings, enable Google and enter the OAuth client ID and secret from Google Cloud. Add each app callback URL to Supabase's allowed redirect URL list:

- `http://localhost:3000/auth/callback`
- `https://YOUR-FRONTEND-DOMAIN/auth/callback`

For the Google OAuth client, add the local and deployed frontend origins as authorized JavaScript origins. Add the Supabase Auth callback URL shown on the Google provider setup screen (the Supabase project `/auth/v1/callback` URL) as an authorized redirect URI in Google Cloud. That provider callback is configured in Google Cloud; the app callback above is the URL Supabase redirects back to after Google sign-in.

### Vercel settings

On the frontend Vercel project, set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. On the backend Vercel project, set `SUPABASE_URL`, either `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`, and `BUDPAY_OWNER_EMAIL`, plus the existing backend secrets. Redeploy both projects after changing environment variables. The anon/publishable key is intended for browser use; never put the Supabase service-role key in any `NEXT_PUBLIC_*` variable or frontend project.

The backend is the RBAC authority. Hiding boss navigation in the frontend is only a usability aid; every protected API checks the verified Supabase user and their current boss or active-roster status.
