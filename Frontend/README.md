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

BudPay uses Supabase Auth for email/password and Google sign-in. The frontend sends the Supabase access token to the separate backend, and the backend verifies it with Supabase Auth on every protected request. Each agency owner creates a workspace from their confirmed account; the owner is the boss for that agency. An active roster email is a crew account for that agency, and crew can submit and view only their own work-hour claims. Jobs, rosters, profiles, portfolio, work logs, and payouts are scoped to the agency. The backend uses the service-role key for database access, so keep that secret on the backend only.

### Local settings

Copy `Frontend/env.example` to `Frontend/.env.local` and set the Supabase project URL, its public anon or publishable key, and the local backend URL. The app builds the `/auth/callback` URL from the current site origin, so it uses localhost locally and the deployed domain after deployment. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` in `Backend/.env` alongside payment settings. `BUDPAY_OWNER_EMAIL` is optional for new installations and is only used to claim the pre-existing Tunde Studio demo workspace once.

### Crew accounts and work-hour claims

Run the complete latest `Backend/schema.sql` in Supabase to add agency-scoped records and create the `work_logs` table. Each company owner signs in, creates an agency workspace, then adds crew to that workspace roster before they sign in. Set **Crew sign-in email** to the member's confirmed Supabase Auth email. It can differ from their PayPal payout email; leaving it blank uses the PayPal email. Crew can submit and view their own claims and cannot access another agency's roster, jobs, or payouts. Only their agency boss can approve or reject claims. Approved claims are not sent as payouts automatically; the boss remains responsible for the fair-share flow.

### Supabase and Google settings

In Supabase Authentication settings, enable email signups and email confirmation. In the Google provider settings, enable Google and enter the OAuth client ID and secret from Google Cloud. Add each app callback URL to Supabase's allowed redirect URL list:

- `http://localhost:3000/auth/callback`
- `https://YOUR-FRONTEND-DOMAIN/auth/callback`
- `http://localhost:3000/reset-password`
- `https://YOUR-FRONTEND-DOMAIN/reset-password`

Set the Supabase **Site URL** to the deployed frontend origin. The app sends an exact callback URL based on the current browser origin, so keep the localhost and deployed callback URLs above in the allowlist. The reset page exchanges the recovery code and lets the owner or an active crew member set a new password.

### Auth email delivery

In **Supabase → Authentication → SMTP Settings**, enable custom SMTP and enter credentials from an email provider. For Resend, the values are:

| Supabase field | Resend value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | An address on a verified Resend domain |
| Sender name | `BudPay` |

Keep the Resend API key in Supabase's SMTP settings; it does not belong in frontend or Vercel environment variables. Other SMTP providers use their own host, port, username, and password.

For the Google OAuth client, add the local and deployed frontend origins as authorized JavaScript origins. Add the Supabase Auth callback URL shown on the Google provider setup screen (the Supabase project `/auth/v1/callback` URL) as an authorized redirect URI in Google Cloud. That provider callback is configured in Google Cloud; the app callback above is the URL Supabase redirects back to after Google sign-in.

### Vercel settings

On the frontend Vercel project, set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. On the backend Vercel project, set `SUPABASE_URL`, either `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`, and the existing backend secrets. `BUDPAY_OWNER_EMAIL` is only needed to bootstrap the existing demo agency. Redeploy both projects after changing environment variables. The anon/publishable key is intended for browser use; never put the Supabase service-role key in any `NEXT_PUBLIC_*` variable or frontend project.

The backend is the RBAC authority. Hiding boss navigation in the frontend is only a usability aid; every protected API checks the verified Supabase user and their current boss or active-roster status.
