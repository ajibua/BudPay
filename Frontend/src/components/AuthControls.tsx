'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleUserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function AuthControls() {
  const { session, loading, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (loading) return null;

  if (session) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-controls="profile-menu"
          aria-label="Profile"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold uppercase text-blue-700">
            {session.user.email?.charAt(0) || <CircleUserRound className="h-4 w-4" />}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div id="profile-menu" hidden={!open} className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{session.user.email}</p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">{role || 'BudPay account'}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); void signOut(); }}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <Link href="/login" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">Sign in</Link>;
}
