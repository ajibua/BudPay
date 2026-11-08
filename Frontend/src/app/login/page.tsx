'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthCallbackUrl, getSupabaseBrowserClient } from '@/lib/supabase';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/split';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
  const denied = searchParams.get('denied') === '1';
  const authError = searchParams.get('auth_error');

  const finishSignIn = async () => {
    setMessage('Checking your boss access…');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${(await getSupabaseBrowserClient()?.auth.getSession())?.data.session?.access_token || ''}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'This account is not authorized to access BudPay.');
    router.replace(result.role === 'crew' ? '/hours' : destination);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Authentication is not configured. Add the Supabase URL and public anon key to the frontend environment.');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthCallbackUrl() } });
        if (authError) throw authError;
        if (!data.session) {
          setMessage('Check your inbox to confirm your email. Then sign in with the same address.');
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
      await finishSignIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.');
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Authentication is not configured. Add the Supabase URL and public anon key to the frontend environment.');
    setBusy(true);
    const callbackUrl = new URL(getAuthCallbackUrl());
    callbackUrl.searchParams.set('next', destination);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">BudPay workspace</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{mode === 'signin' ? 'Sign in to BudPay' : 'Create a BudPay account'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Boss accounts can manage the workspace. Active crew members can sign in with the email saved on the roster to submit their work hours.</p>
        {denied && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This account is not the configured boss or an active crew member on this workspace roster.</p>}
        {authError === 'backend_unavailable' && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Google sign-in worked, but BudPay could not verify boss access. Check the backend URL and try again.</p>}
        {authError && authError !== 'backend_unavailable' && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Google sign-in could not be completed. Start again here, using the same browser and app address.</p>}
        {!configured && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Supabase auth needs NEXT_PUBLIC_SUPABASE_URL and a public anon or publishable key in the frontend environment.</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        <button type="button" onClick={() => void signInWithGoogle()} disabled={busy || !configured} className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">Continue with Google</button>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use email<span className="h-px flex-1 bg-slate-200" /></div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm font-semibold text-slate-700">Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <button type="submit" disabled={busy || !configured} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>

        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }} className="mt-5 w-full text-center text-sm font-semibold text-blue-700 hover:text-blue-900">{mode === 'signin' ? 'New to BudPay? Create an account' : 'Already have an account? Sign in'}</button>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading sign in…</div>}><LoginForm /></Suspense>;
}
