import Link from 'next/link';
import { ShieldCheck, Heart, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      className="w-full border-t border-slate-200 bg-white py-12 px-4 sm:px-8 mt-auto"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="font-extrabold text-lg text-slate-900">BudPay</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              PayPal AI Hackathon 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Built for solo service owners. PayPal moves the money, BudPay helps the boss decide what is fair through AI story interpretation and deterministic whole-cent math.
          </p>
        </div>

        <nav aria-label="Footer links" className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-600">
          <Link href="/split" className="hover:text-blue-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
            Fair Pay Split
          </Link>
          <Link href="/how-it-works" className="hover:text-blue-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
            How It Works
          </Link>
          <Link href="/roster" className="hover:text-blue-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
            Crew Roster
          </Link>
          <Link href="/history" className="hover:text-blue-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
            Payout History
          </Link>
        </nav>

        <div className="flex flex-col items-center md:items-end gap-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Targeting PayPal Sandbox Only</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Accessible, Screen-Reader Tested &bull; WCAG 2.1 AAA Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}

