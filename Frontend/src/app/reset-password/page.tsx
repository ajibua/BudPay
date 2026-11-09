'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const { session, loading, role, accessError, refreshAccess } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Authentication is not configured. Please contact the agency administrator.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setUpdated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the password. Please request a new reset email.');
    } finally {
      setBusy(false);
    }
  };

  const destination = role === 'crew' ? '/hours' : role === 'onboarding' ? '/agency/setup' : '/split';

  if (accessError) {
    return <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center"><p role="alert" className="text-sm text-rose-700">{accessError}</p><button type="button" onClick={refreshAccess} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Retry workspace check</button></main>;
  }

  if (loading || (session && !role)) {
    return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 text-sm text-slate-500" role="status">Checking your reset link…</main>;
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">Reset link expired</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Request a fresh password reset email and open its link in this browser.</p>
          <Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Back to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">BudPay workspace</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Choose a new password</h1>
        {updated ? (
          <div className="mt-5 space-y-4" role="status">
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Your password has been updated.</p>
            <Link href={destination} className="inline-flex rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Continue to BudPay</Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use at least 8 characters. You can sign in with this password after saving it.</p>
            {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <form onSubmit={updatePassword} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block text-sm font-semibold text-slate-700">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Saving password…' : 'Save new password'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
