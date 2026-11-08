'use client';

import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Users,
  History,
  Lock,
  HeartHandshake,
  DollarSign,
  Clock,
  Layers,
  ChevronRight,
  Zap,
  HelpCircle
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-24 py-10 sm:py-16">
      {/* Hero Section */}
      <section aria-labelledby="hero-heading" className="max-w-5xl mx-auto px-4 sm:px-8 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
          <Sparkles className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <span>PayPal AI Hackathon 2026 &bull; Fair Pay Helper</span>
        </div>

        <h1
          id="hero-heading"
          className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] max-w-4xl mx-auto"
        >
          PayPal moves the money.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            BudPay helps the boss decide what is fair.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
          For solo service owners splitting lump-sum customer payments with their crew. Tell the story in plain words, adjust the boss slider, and let deterministic whole-cent math dispatch real PayPal Sandbox payouts.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/split"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base shadow-lg shadow-blue-500/25 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          >
            <Calculator className="w-5 h-5" aria-hidden="true" />
            Start Fair Pay Split
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>

          <Link
            href="/how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-base border border-slate-300 shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          >
            <HelpCircle className="w-5 h-5 text-slate-500" aria-hidden="true" />
            How It Works
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>PayPal Sandbox Verified</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Lock className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <span>Deterministic Math Guardrails</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span>Zero-Downtime Resilience</span>
          </div>
        </div>
      </section>

      {/* The 4 Core Principles Preview */}
      <section aria-labelledby="pillars-heading" className="max-w-6xl mx-auto px-4 sm:px-8">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">The Architecture</span>
          <h2 id="pillars-heading" className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How The Money Actually Moves
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            BudPay removes the awkwardness and secrecy around crew splits with 4 transparent guardrails.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3 hover:border-blue-300 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Money & Costs First</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Customer pays upfront. Material expenses (fabric, spices, fuel) come off first before dividing anything.
            </p>
          </article>

          {/* Card 2 */}
          <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3 hover:border-blue-300 transition">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Plain Words Story</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Boss tells the story naturally. Gemini AI extracts roles, hours, and skill weights. AI never touches dollar amounts.
            </p>
          </article>

          {/* Card 3 */}
          <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3 hover:border-blue-300 transition">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-lg">The Pennies Rule</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Boss slider decides the boss profit. The crew pile is divided using deterministic integer math down to the whole cent.
            </p>
          </article>

          {/* Card 4 */}
          <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3 hover:border-blue-300 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              4
            </div>
            <h3 className="font-bold text-slate-900 text-lg">PayPal Batch Payout</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Single approved batch payout sends exact funds to each crew email with personal appreciation notes and live status.
            </p>
          </article>
        </div>
      </section>

      {/* The Tunde Example Featurette */}
      <section aria-labelledby="example-banner-heading" className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Worked Example</span>
            <h2 id="example-banner-heading" className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              &ldquo;Tola sewed for 8 hours. Bisi did finishing for 5 hours. Kunle did delivery for 2 hours.&rdquo;
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              From a $200.00 customer payment with $40.00 cloth costs and $90.00 boss share, the $70.00 crew pile splits with mathematical perfection:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Tola (Apprentice)</span>
              <div className="text-2xl font-bold text-emerald-400">$35.00</div>
              <span className="text-[11px] text-slate-300">8 hrs &times; 1.5 weight (50.0%)</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Bisi (Finishing)</span>
              <div className="text-2xl font-bold text-emerald-400">$29.17</div>
              <span className="text-[11px] text-slate-300">5 hrs &times; 2.0 weight (41.7%)</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Kunle (Rider)</span>
              <div className="text-2xl font-bold text-emerald-400">$5.83</div>
              <span className="text-[11px] text-slate-300">2 hrs &times; 1.0 weight (8.3%)</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
            <span className="text-xs text-slate-400 font-mono">
              Sum: $35.00 + $29.17 + $5.83 = $70.00 exact (0 penny float discrepancy)
            </span>
            <Link
              href="/split"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              Test This Job Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation Quick Links Section */}
      <section aria-labelledby="quick-nav-heading" className="max-w-5xl mx-auto px-4 sm:px-8 space-y-6">
        <h2 id="quick-nav-heading" className="text-xl font-bold text-slate-900 text-center">
          Explore BudPay Dedicated Modules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/split"
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center justify-between">
              <span>Fair sharing</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Run the 4-step interactive wizard from customer payment to live PayPal receipt.
            </p>
          </Link>

          <Link
            href="/roster"
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center justify-between">
              <span>Crew details</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add and manage active crew members, baseline skill weights, and PayPal emails dynamically.
            </p>
          </Link>

          <Link
            href="/history"
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
              <History className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center justify-between">
              <span>Payout History</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Audit past jobs, view captured payments, and verify PayPal batch transaction IDs.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
