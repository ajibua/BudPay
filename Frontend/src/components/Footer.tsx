import Link from 'next/link';

export default function Footer() {
  return (
    <footer role="contentinfo" aria-label="Site footer" className="mt-auto w-full bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <div className="grid gap-9 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
          <div className="max-w-md space-y-3">
            <Link
              href="/"
              aria-label="BudPay home"
              className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-lg font-extrabold text-white shadow-lg shadow-blue-950/40">
                B
              </span>
              <span className="text-lg font-extrabold tracking-tight">BudPay</span>
            </Link>
            <p className="text-sm leading-relaxed text-slate-300">
              Clear, thoughtful ways for small teams to share the value of their work.
            </p>
          </div>

          <nav aria-label="Footer links" className="md:justify-self-end">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Explore BudPay</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-200">
              <Link href="/split" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Fair pay split
              </Link>
              <Link href="/how-it-works" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                How it works
              </Link>
              <Link href="/roster" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Crew details
              </Link>
              <Link href="/history" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Payout history
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© BudPay</span>
          <span>PayPal moves the money. BudPay makes the split clear.</span>
        </div>
      </div>
    </footer>
  );
}
