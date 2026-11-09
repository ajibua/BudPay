import Link from 'next/link';
import Footer from '@/components/Footer';
import AgencyWorkspaceLink from '@/components/AgencyWorkspaceLink';
import {
  Sparkles,
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
  BriefcaseBusiness,
  Store
} from 'lucide-react';

export default function LandingPage() {
  return (
    <>
    <div className="space-y-24 py-10 sm:py-16">
      {/* Hero Section */}
      <section aria-labelledby="hero-heading" className="max-w-5xl mx-auto px-4 sm:px-8 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
          <Sparkles className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <span>Book services. Pay teams fairly.</span>
        </div>

        <h1
          id="hero-heading"
          className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] max-w-4xl mx-auto"
        >
          Find a team.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Get the work done. Pay fairly.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
          Discover service businesses, book with confidence, and pay securely. Agencies manage the work and use BudPay to share earnings fairly with their teams.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/marketplace"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base shadow-lg shadow-blue-500/25 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          >
            <BriefcaseBusiness className="w-5 h-5" aria-hidden="true" />
            Browse services
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>

          <AgencyWorkspaceLink />
        </div>
        <Link href="/agencies" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">Discover agencies on BudPay <ArrowRight className="h-4 w-4" /></Link>

        {/* Trust Badges */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>PayPal Sandbox checkout and payouts</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Lock className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <span>Exact-cent split calculations</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span>Private agency crew workspaces</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="budpay-story-heading" className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        <div className="max-w-3xl"><span className="text-xs font-bold uppercase tracking-wider text-blue-700">The BudPay story</span><h2 id="budpay-story-heading" className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Good work starts with the right team, and ends with a fair share.</h2><p className="mt-3 text-base leading-7 text-slate-600">BudPay connects customers who need a service with agencies that can deliver it, then gives each agency a private workspace to organize the work and pay the people behind it.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><BriefcaseBusiness className="h-5 w-5" /></span><p className="mt-4 text-xs font-black uppercase tracking-wider text-indigo-700">01 · Agencies</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">A company sets up its home.</h3><p className="mt-2 text-sm leading-6 text-slate-600">The owner creates an agency profile, shares its story and work, publishes services, and builds a private crew workspace.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Store className="h-5 w-5" /></span><p className="mt-4 text-xs font-black uppercase tracking-wider text-blue-700">02 · Discovery</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">Customers find a team.</h3><p className="mt-2 text-sm leading-6 text-slate-600">People explore agencies, compare the services on offer, and choose the company that fits the job they have in mind.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><HeartHandshake className="h-5 w-5" /></span><p className="mt-4 text-xs font-black uppercase tracking-wider text-emerald-700">03 · The service</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">The customer brings the request.</h3><p className="mt-2 text-sm leading-6 text-slate-600">They share the details with the company, book as a guest, and approve payment through PayPal Sandbox. The agency takes ownership of delivery.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Calculator className="h-5 w-5" /></span><p className="mt-4 text-xs font-black uppercase tracking-wider text-amber-700">04 · Fair sharing</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">BudPay helps the team share.</h3><p className="mt-2 text-sm leading-6 text-slate-600">The agency tracks the job, reviews crew contributions, and prepares a transparent split. The boss checks and approves payouts to the crew.</p></article>
        </div>
        <div className="flex flex-wrap gap-3"><Link href="/agencies" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:border-blue-300 hover:text-blue-800">Discover agencies <ArrowRight className="h-4 w-4" /></Link><Link href="/marketplace" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Find a service <ArrowRight className="h-4 w-4" /></Link></div>
      </section>

      <section aria-labelledby="two-sides-heading" className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-8 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800"><BriefcaseBusiness className="h-4 w-4" /> For customers</span>
          <h2 id="two-sides-heading" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Hire a company. Let them handle the crew.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Start in the marketplace: browse a service, compare its price and turnaround, and tell the agency what you need. Book as a guest, approve payment with PayPal, then return to BudPay to confirm it. You get a booking reference; the agency gets the job and your contact details.</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">You work with the service provider as one company. Its internal crew hours and payout shares stay in the agency workspace.</p>
          <Link href="/marketplace" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Browse services as a guest <ArrowRight className="h-4 w-4" /></Link>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-slate-950 p-7 text-white shadow-sm sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-200"><Users className="h-4 w-4" /> For agencies</span>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">One paid job, a whole team behind it.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">When a customer payment is confirmed, the agency sees the service, payment, and request in its jobs workspace. The owner coordinates the work, reviews what each person contributed, and uses BudPay to calculate a fair split with exact-cent math.</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">The boss reviews the result and explicitly approves the crew payout. Workers can sign in to log their own hours; the customer never has to manage those internal steps.</p>
          <AgencyWorkspaceLink
            signedOutLabel="Agency sign in"
            iconClassName="text-slate-300"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
          />
        </article>
      </section>

      {/* The 4 Core Principles Preview */}
      <section aria-labelledby="pillars-heading" className="max-w-6xl mx-auto px-4 sm:px-8">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Inside the agency workspace</span>
          <h2 id="pillars-heading" className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How BudPay helps the agency share fairly
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            The customer books the company&apos;s service. After the work is done, BudPay helps the company review contributions and decide how its team gets paid.
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
              Run the four-step wizard from customer payment to crew payout receipt.
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
    <Footer />
    </>
  );
}
