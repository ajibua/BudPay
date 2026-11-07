'use client';

import Link from 'next/link';
import { Sparkles, Sliders, ShieldCheck, ArrowRight, CheckCircle2, DollarSign, Calculator, Lock, Users } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-16">
      {/* Hero */}
      <section aria-labelledby="how-it-works-heading" className="text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          The BudPay Principles
        </span>
        <h1 id="how-it-works-heading" className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          How BudPay Decides What Is Fair
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          &ldquo;PayPal moves the money. BudPay helps the boss decide what is fair.&rdquo; Here is how our four-step pipeline turns natural words into exact penny payouts.
        </p>
      </section>

      {/* 4 Steps Grid */}
      <section aria-label="Four Core Steps" className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Step 1 */}
        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-extrabold text-xl flex items-center justify-center">
            1
          </div>
          <h2 className="text-xl font-bold text-slate-900">Step 1: Money Up Front & Costs First</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every job starts with the total amount paid by the customer. Before anyone talks about profit or earnings, out-of-pocket material expenses (such as fabric, spices, or vehicle fuel) are deducted immediately.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            Gross Pool = Customer Payment - Material Expenses
          </div>
        </article>

        {/* Step 2 */}
        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-extrabold text-xl flex items-center justify-center">
            2
          </div>
          <h2 className="text-xl font-bold text-slate-900">Step 2: Tell The Story in Plain Words</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The boss types or speaks naturally (e.g. &ldquo;Tola sewed for 8 hours. Bisi finished the hems for 5 hours. Kunle did deliveries for 2 hours.&rdquo;). Google Gemini AI extracts roles, hours, and skill weights without touching dollar amounts.
          </p>
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800">
            Hard Guardrail: The AI never calculates dollars; only roles, hours, and appreciation notes.
          </div>
        </article>

        {/* Step 3 */}
        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 font-extrabold text-xl flex items-center justify-center">
            3
          </div>
          <h2 className="text-xl font-bold text-slate-900">Step 3: Boss Slider & The Pennies Rule</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The boss adjusts their own share slider. The remainder is the &ldquo;crew pile&rdquo;. BudPay calculates each crew member&apos;s points using <code className="bg-slate-100 px-1 py-0.5 rounded">hours &times; skillWeight</code> and allocates exact cents with zero float drift.
          </p>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs font-mono text-amber-900">
            Crew Member Cents = floor((points / totalPoints) * crewPileCents)
          </div>
        </article>

        {/* Step 4 */}
        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-extrabold text-xl flex items-center justify-center">
            4
          </div>
          <h2 className="text-xl font-bold text-slate-900">Step 4: PayPal Sandbox Batch Payout</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Once reviewed and approved by the boss, BudPay dispatches a single atomic batch payout through PayPal&apos;s Payouts API. Each crew member receives their exact funds along with a warm, personalized thank-you note.
          </p>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            Live Polling: Real-time receipt shows Paid, Waiting, or Problem badges.
          </div>
        </article>
      </section>

      {/* Worked Example Table */}
      <section aria-labelledby="worked-example-heading" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Canonical Hackathon Example
          </span>
          <h2 id="worked-example-heading" className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Tunde the Tailor&apos;s Wedding Job
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Customer paid $200.00. Material costs were $40.00. Tunde chose a $90.00 boss share. The remaining crew pile is exactly $70.00 (7,000 cents).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <caption className="sr-only">Tunde the Tailor worked split calculation table</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500 bg-slate-50">
                <th scope="col" className="py-3 px-4 rounded-l-xl">Crew Member</th>
                <th scope="col" className="py-3 px-4">Role</th>
                <th scope="col" className="py-3 px-4">Hours</th>
                <th scope="col" className="py-3 px-4">Skill Weight</th>
                <th scope="col" className="py-3 px-4">Points</th>
                <th scope="col" className="py-3 px-4">Share %</th>
                <th scope="col" className="py-3 px-4 rounded-r-xl">Exact Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <th scope="row" className="py-3 px-4 font-bold text-slate-900">Tola (Apprentice)</th>
                <td className="py-3 px-4 text-slate-600">Sewing Outfits</td>
                <td className="py-3 px-4 text-slate-600">8.0 hrs</td>
                <td className="py-3 px-4 text-slate-600">1.5</td>
                <td className="py-3 px-4 font-mono text-slate-700">12.0</td>
                <td className="py-3 px-4 text-slate-600">50.0%</td>
                <td className="py-3 px-4 font-bold text-emerald-700">$35.00</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 px-4 font-bold text-slate-900">Bisi (Seamstress)</th>
                <td className="py-3 px-4 text-slate-600">Finishing & Hems</td>
                <td className="py-3 px-4 text-slate-600">5.0 hrs</td>
                <td className="py-3 px-4 text-slate-600">2.0</td>
                <td className="py-3 px-4 font-mono text-slate-700">10.0</td>
                <td className="py-3 px-4 text-slate-600">41.7%</td>
                <td className="py-3 px-4 font-bold text-emerald-700">$29.17</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 px-4 font-bold text-slate-900">Kunle (Rider)</th>
                <td className="py-3 px-4 text-slate-600">Delivery</td>
                <td className="py-3 px-4 text-slate-600">2.0 hrs</td>
                <td className="py-3 px-4 text-slate-600">1.0</td>
                <td className="py-3 px-4 font-mono text-slate-700">2.0</td>
                <td className="py-3 px-4 text-slate-600">8.3%</td>
                <td className="py-3 px-4 font-bold text-emerald-700">$5.83</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-extrabold text-slate-900 bg-slate-50">
                <th scope="row" colSpan={4} className="py-3 px-4 rounded-l-xl">Total Crew Pile Reconciled</th>
                <td className="py-3 px-4 font-mono">24.0 pts</td>
                <td className="py-3 px-4">100.0%</td>
                <td className="py-3 px-4 text-emerald-700 rounded-r-xl">$70.00</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="pt-2 flex justify-end">
          <Link
            href="/split"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          >
            Try This Worked Example Live
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

