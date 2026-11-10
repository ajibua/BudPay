'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PayPalAgencyReturnPage() {
  const { session, loading } = useAuth();
  const started = useRef(false);
  const [working, setWorking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (!session) {
      setError('Your BudPay session expired during PayPal setup. Sign back in to check the agency connection.');
      setWorking(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const trackingId = params.get('merchantId') || '';
    const merchantId = params.get('merchantIdInPayPal') || '';
    const permissionsGranted = params.get('permissionsGranted') === 'true';
    const consentStatus = params.get('consentStatus') === 'true';
    const isEmailConfirmed = params.get('isEmailConfirmed') === 'true';

    if (!trackingId || !merchantId) {
      setError('PayPal did not return the agency and seller IDs. Go back to Agency Jobs and restart the connection.');
      setWorking(false);
      return;
    }

    apiFetch(`${API_URL}/api/paypal/agency/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId, merchantId, permissionsGranted, consentStatus, isEmailConfirmed })
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'BudPay could not verify the PayPal seller connection.');
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : 'BudPay could not verify the PayPal seller connection.');
    }).finally(() => setWorking(false));
  }, [loading, session]);

  return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12"><section className="w-full rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
    {working ? <><LoaderCircle className="mx-auto h-10 w-10 animate-spin text-blue-700" /><h1 className="mt-5 text-2xl font-extrabold text-slate-900">Verifying agency account</h1><p className="mt-2 text-sm leading-6 text-slate-600">BudPay is checking the seller connection and permissions with PayPal Sandbox.</p></> : error ? <><ShieldAlert className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-5 text-2xl font-extrabold text-slate-900">Connection needs attention</h1><p role="alert" className="mt-3 text-sm leading-6 text-rose-700">{error}</p><Link href="/history" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Return to Agency Jobs</Link></> : <><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h1 className="mt-5 text-2xl font-extrabold text-slate-900">PayPal seller connected</h1><p className="mt-2 text-sm leading-6 text-slate-600">BudPay verified the agency&apos;s Sandbox seller account. Check Agency Jobs for payment and payout permission status.</p><Link href="/history" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Go to Agency Jobs</Link></>}
  </section></main>;
}
