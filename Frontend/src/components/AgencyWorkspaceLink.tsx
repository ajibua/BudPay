'use client';

import Link from 'next/link';
import { ArrowRight, Calculator } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function AgencyWorkspaceLink({
  className,
  iconClassName = 'text-slate-500',
  signedOutLabel = 'Agency workspace',
}: {
  className?: string;
  iconClassName?: string;
  signedOutLabel?: string;
}) {
  const { session, loading, role } = useAuth();
  const checkingAccess = loading || Boolean(session && !role);
  const href = role === 'boss' ? '/split' : role === 'crew' ? '/hours' : role === 'onboarding' ? '/agency/setup' : '/login';
  const label = checkingAccess
    ? 'Checking access…'
    : role === 'crew'
      ? 'My hours'
      : role === 'onboarding'
        ? 'Set up agency'
      : signedOutLabel;
  const linkClassName = className || 'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-slate-800 font-bold text-base border border-slate-300 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600';

  return (
    <Link
      href={href}
      aria-disabled={checkingAccess}
      onClick={event => { if (checkingAccess) event.preventDefault(); }}
      className={`${linkClassName} ${checkingAccess ? 'cursor-wait opacity-70' : ''}`}
    >
      <Calculator className={`w-5 h-5 ${iconClassName}`} aria-hidden="true" />
      {label}
      {!checkingAccess && <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />}
    </Link>
  );
}
