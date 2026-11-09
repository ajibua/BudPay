'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import AuthControls from '@/components/AuthControls';
import { useAuth } from '@/components/AuthProvider';

export default function Navbar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  if (pathname === '/login' || pathname.startsWith('/auth/')) return null;

  const navLinks = role === 'boss'
    ? [
        { href: '/agencies', label: 'Agencies' },
        { href: '/marketplace', label: 'Marketplace' },
        { href: '/history', label: 'Agency jobs' },
        { href: '/roster', label: 'Crew' },
        { href: '/hours', label: 'Hours' },
      ]
    : role === 'crew'
      ? [
          { href: '/agencies', label: 'Agencies' },
          { href: '/marketplace', label: 'Marketplace' },
          { href: '/hours', label: 'My hours' },
        ]
      : [
          { href: '/agencies', label: 'Agencies' },
          { href: '/marketplace', label: 'Marketplace' },
          { href: '/how-it-works', label: 'How it works' },
        ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="BudPay home" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">B</span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">BudPay</span>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isActive(link.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthControls />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav id="mobile-navigation" hidden={!mobileMenuOpen} aria-label="Mobile navigation" className="border-t border-slate-200 px-4 py-2 md:hidden">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(link.href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100'
                  }`}
              >
                {link.label}
              </Link>
            ))}
        </nav>
      </header>
    </>
  );
}
