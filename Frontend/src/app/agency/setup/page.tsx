'use client';

import { useState, type FormEvent } from 'react';
import { BriefcaseBusiness, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AgencySetupPage() {
  const { role, loading, accessError, refreshAccess } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createAgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await apiFetch(`${API_URL}/api/agencies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not create the agency workspace.');
      window.location.assign('/marketplace');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the agency workspace.');
      setBusy(false);
    }
  }

  if (accessError) return <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center"><p role="alert" className="text-sm text-rose-700">{accessError}</p><button type="button" onClick={refreshAccess} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Retry workspace check</button></main>;
  if (loading || role !== 'onboarding') return <main className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Checking account</main>;

  return <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12"><section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><BriefcaseBusiness className="h-6 w-6" /></div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-blue-700">Agency workspace setup</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Bring your team onto BudPay</h1><p className="mt-3 text-sm leading-6 text-slate-600">Create a separate workspace for your company. Your services, customers, crew roster, work logs, and payout history will stay within this agency.</p><form onSubmit={createAgency} className="mt-7 space-y-4"><label className="block text-sm font-bold text-slate-800">Agency or company name<input required minLength={2} maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Tunde's Tailoring Studio" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? 'Creating workspace…' : 'Create agency workspace'}</button></form><p className="mt-4 text-xs leading-5 text-slate-500">The signed-in account becomes the agency boss. Add crew members from the workspace roster after setup.</p></section></main>;
}
