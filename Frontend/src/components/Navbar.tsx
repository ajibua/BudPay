'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ShieldCheck, Menu, X, Users, History, HelpCircle, Calculator, Sparkles } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/split', label: 'Fair share', icon: Calculator },
    { href: '/how-it-works', label: 'How It Works', icon: HelpCircle },
    { href: '/roster', label: 'Crew details', icon: Users },
    { href: '/history', label: 'Payout History', icon: History }
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Skip Link for Screen Readers / Keyboard Impaired Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-700 focus:text-white focus:rounded-xl focus:shadow-xl focus:ring-4 focus:ring-blue-400 font-bold text-sm"
      >
        Skip to main content
      </a>

      <header
        role="banner"
        className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            href="/"
            aria-label="BudPay Home - The Fair Pay Helper"
            className="flex items-center space-x-3 group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 rounded-xl p-1"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">BudPay</span>
                <span className="hidden sm:inline text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  The Fair share helper
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                PayPal moves the money. BudPay helps the boss decide what is fair.
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Routes */}
          <nav role="navigation" aria-label="Main menu" className="hidden md:flex items-center space-x-1">
            {navLinks.map(link => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 ${active
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Sandbox Indicator & CTA */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div
              role="status"
              aria-label="PayPal Sandbox environment active"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span className="hidden xs:inline">PayPal</span> Sandbox
            </div>

            <Link
              href="/split"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Start sharing
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-navigation"
            className="md:hidden mt-3 pt-3 border-t border-slate-200 space-y-1"
          >
            {navLinks.map(link => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${active
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>
    </>
  );
}
