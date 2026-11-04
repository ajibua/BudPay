# BudPay: The Fair Pay Helper

> **"PayPal moves the money. BudPay helps the boss decide what is fair."**  
> *Project built for the PayPal AI Hackathon &bull; November 2026*

---

## 1. The Story

Imagine a tailor named **Tunde**. A customer asks him to sew custom outfits for a wedding. Tunde cannot do it alone:
- **Tola** (his apprentice) sews the clothes.
- **Bisi** (a seamstress) does the delicate hand finishing.
- **Kunle** (a rider) delivers the outfits across town.

The customer pays Tunde one lump sum payment. Now Tunde faces an awkward, time-consuming dilemma: **sharing the money.**
- Who worked the most?
- What is a fair share for each role's skill level?
- Doing the math by hand is slow and easy to get wrong.

**BudPay** solves this:
1. **Tell the story:** Tunde speaks or types what happened in plain words (*"Tola sewed for 8 hours. Bisi finished for 5 hours. Kunle did delivery for 2 hours."*).
2. **AI extracts the facts:** Gemini parses the story into structured roles, hours, and tasks.
3. **Transparent math:** BudPay subtracts upfront material costs, lets Tunde set his own profit share via a slider, and computes the crew payout using weighted points.
4. **Human in control:** Tunde reviews, tweaks any number or bonus, and approves.
5. **Instant split payout:** With one click of **Send**, PayPal Payouts sends money to everyone simultaneously, accompanied by personalized AI thank-you notes.

---

## 2. Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │               Frontend (Next.js Dining Room)            │
   │  - Story submission (text/speech)                       │
   │  - Interactive sliders & slice breakdown               │
   │  - Real-time payout receipt & status                    │
   └───────────────────────────┬─────────────────────────────┘
                               │ HTTP / JSON
   ┌───────────────────────────▼─────────────────────────────┐
   │               Backend (Express.js Kitchen)              │
   │  - Strict Sandbox Guardrail & validation                │
   │  - Deterministic whole-cent points & slices engine      │
   │  - State machine: Draft -> Reviewed -> Approved -> Sent │
   └───────────────┬─────────────────────────┬───────────────┘
                   │                         │
     ┌─────────────▼──────────┐   ┌──────────▼───────────────┐
     │      Gemini AI         │   │   PayPal Sandbox APIs    │
     │  - Story parsing & NLP │   │  - Orders (Customer Pay) │
     │  - Personal thank-yous │   │  - Payouts (Crew Batch)  │
     └────────────────────────┘   └──────────────────────────┘
```

- **Frontend:** Next.js (App Router, React 19, TypeScript, Tailwind CSS, Lucide icons)
- **Backend:** Express.js (Node.js ES modules, CORS, Dotenv)
- **AI:** Google Gemini API (Structured output parsing & tone-adaptive thank-you notes)
- **Payments:** PayPal REST APIs (Sandbox Orders + Batch Payouts)
- **Database:** Supabase / PostgreSQL (Tracking jobs, crew members, audit logs)

---

## 3. Strict Guardrails: Code Keeps the Rules

Even if the AI misunderstands or makes an error, the backend code strictly enforces safety locks:

| Rule | What the AI is told | What the Code enforces |
|---|---|---|
| **Boss share is untouched** | *"Do not change the boss's share"* | Boss share is derived **strictly** from the UI slider. The AI never sees or touches this number. |
| **Exact Penny Match** | *"Make the numbers add up"* | Code computes strictly in integer whole cents. Total shares must equal 100.00% of the crew pile; otherwise, **Send is locked**. |
| **No Auto-Sending** | *"Wait for the boss"* | Payouts require an explicit human state transition (`draft` &rarr; `reviewed` &rarr; `approved` &rarr; `sent`). The AI cannot trigger payment endpoints. |
| **Whitelist Only** | *"Only pay people in the story"* | Payouts only go to pre-registered crew accounts. The AI cannot inject unknown recipient emails. |
| **Idempotency Lock** | *(Prompt cannot handle this)* | Every payout batch has a unique cryptographic batch ID. Double-clicking or retrying will **never** pay twice. |
| **Strict Sandbox Enforcement** | *"Use sandbox only"* | The server halts immediately on startup if connected to live PayPal endpoints. |

---

## 4. Project Structure

```
├── Backend/
│   ├── src/
│   │   └── server.js            # Express app with sandbox safety checks & /api/health
│   ├── .env.example             # Template for PayPal, Gemini, and Supabase credentials
│   ├── package.json             # ES Module Express service
├── Frontend/
│   ├── src/
│   │   └── app/                 # Next.js App Router & Tailwind UI
│   ├── .env.local.example       # Points to Backend (http://localhost:5000)
│   ├── package.json             # Next.js client
├── .gitignore                   # Prevents credential and node_modules leakage
└── README.md                    # Project documentation & reference
```

---

## 5. Getting Started Locally

### Prerequisites
- Node.js v20+ / v24+
- npm or pnpm

### 1. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env

npm run dev

```

### 2. Frontend Setup
```bash
cd Frontend
npm install
npm run dev

```

### 3. Verify Health
Open [http://localhost:3000](http://localhost:3000) to see the live connection status connecting the Next.js dining room to the Express kitchen.

---

## 6. Hackathon Roadmap

- [x] **Day 1 (Nov 4): Kitchen & Dining Room** &mdash; Scaffolding, Express & Next.js connection, sandbox safety verification, project plan alignment.
- [ ] **Day 2 (Nov 5): PayPal Auth & Sandbox Testing** &mdash; Sandbox credentials, OAuth2 token generation, single test payout.
- [ ] **Day 3 (Nov 6): Story Understanding** &mdash; Gemini API integration to parse plain-text job stories into structured crew rosters.
- [ ] **Day 4 (Nov 7): Fair Pay Math Engine** &mdash; Points weighted calculation, whole-cent rounding (pennies rule), automated guardrail tests.
- [ ] **Day 5 (Nov 8): Interactive Experience** &mdash; Story box, review breakdown, dynamic sliders, bonus allocator.
- [ ] **Day 6 (Nov 9): Full Money Connection** &mdash; Customer checkout integration, PayPal batch payouts, real-time receipt status dashboard.
- [ ] **Day 7 (Nov 10): Polish & Edge Cases** &mdash; Anomaly alerts ("this looks odd"), idempotent payment verification.
- [ ] **Day 8 (Nov 11): Deployment & Demo** &mdash; Live hosting, 3-minute video walkthrough, final documentation.
- [ ] **Day 9 (Nov 12): Buffer & Early Submission.**

