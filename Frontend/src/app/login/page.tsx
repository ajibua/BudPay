'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthCallbackUrl, getPasswordResetUrl, getSupabaseBrowserClient } from '@/lib/supabase';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/split';
  const [mode, setMode] = useState<'signin' | 'signup'>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
  const denied = searchParams.get('denied') === '1';
  const authError = searchParams.get('auth_error');

  const finishSignIn = async () => {
    setMessage('Checking your BudPay workspace access…');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${(await getSupabaseBrowserClient()?.auth.getSession())?.data.session?.access_token || ''}` }
    });
    const result = await response.json().catch(() => ({}));
    if (response.status >= 500) {
      router.replace('/marketplace');
      return;
    }
    if (!response.ok) throw new Error(result.error || 'This account is not authorized to access BudPay.');
    router.replace(result.role === 'crew' ? '/hours' : result.role === 'onboarding' ? '/agency/setup' : destination);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setConfirmationPending(false);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Authentication is not configured. Add the Supabase URL and public anon key to the frontend environment.');
    if (mode === 'signup' && password !== confirmPassword) return setError('The passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: getAuthCallbackUrl() } });
        if (authError) throw authError;
        if (!data.session) {
          setMessage('Check your inbox to confirm your email. Open the link in this browser, then you will continue to agency setup or your crew workspace.');
          setConfirmationPending(true);
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (authError) throw authError;
      }
      await finishSignIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Authentication is not configured. Add the Supabase URL and public anon key to the frontend environment.');
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getAuthCallbackUrl() },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start Google sign-in. Please try again.');
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: getAuthCallbackUrl() },
      });
      if (resendError) throw resendError;
      setMessage('If confirmation is still needed, Supabase has sent a fresh link. Check your inbox and spam folder.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the confirmation email. Please wait a moment and try again.');
    } finally { setBusy(false); }
  };

  const sendPasswordReset = async () => {
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Enter your account email first, then choose Forgot password.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Authentication is not configured. Add the Supabase URL and public anon key to the frontend environment.');
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getPasswordResetUrl(),
      });
      if (resetError) throw resetError;
      setMessage('If an account exists for that address, Supabase has sent a password reset email. Check your inbox and spam folder.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request a password reset. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">BudPay workspace</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{mode === 'signin' ? 'Sign in to BudPay' : 'Create a BudPay account'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This sign-in is for company owners and crew.</p>
        {denied && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This account could not be connected to a BudPay workspace. Ask your agency owner to check your crew sign-in email.</p>}
        {authError === 'backend_unavailable' && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Your account was verified, but BudPay could not check workspace access. Check the backend URL and try again.</p>}
        {authError === 'session_expired' && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your BudPay session expired. Sign in again to continue.</p>}
        {authError === 'link_expired' && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">That email link has expired or was already used. Request a fresh confirmation or password reset link.</p>}
        {authError === 'exchange_failed' && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">BudPay could not complete the email sign-in link. Request a fresh link and open it in the same browser where you started.</p>}
        {authError && !['backend_unavailable', 'session_expired', 'link_expired', 'exchange_failed'].includes(authError) && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Sign-in could not be completed. Start again here, using the same browser and app address.</p>}
        {!configured && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Supabase auth needs NEXT_PUBLIC_SUPABASE_URL and a public anon or publishable key in the frontend environment.</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        <button type="button" onClick={() => void signInWithGoogle()} disabled={busy || !configured} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.75 3.28-8.09Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.96 6.96 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45.99 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.06L5.84 8.9C6.71 6.3 9.14 4.36 12 4.36Z" />
          </svg>
          Continue with Google
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use email<span className="h-px flex-1 bg-slate-200" /></div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm font-semibold text-slate-700">Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          {mode === 'signup' && <label className="block text-sm font-semibold text-slate-700">Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>}
          {mode === 'signin' && <div className="-mt-2 text-right"><button type="button" onClick={() => void sendPasswordReset()} disabled={busy || !configured} className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50">Forgot password?</button></div>}
          <button type="submit" disabled={busy || !configured} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>

        {confirmationPending && <button type="button" onClick={() => void resendConfirmation()} disabled={busy || !configured} className="mt-4 w-full text-center text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50">{busy ? 'Sending confirmation…' : 'Didn’t get the email? Resend confirmation'}</button>}

        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setConfirmationPending(false); setConfirmPassword(''); }} className="mt-5 w-full text-center text-sm font-semibold text-blue-700 hover:text-blue-900">{mode === 'signin' ? 'New to BudPay? Create an account' : 'Already have an account? Sign in'}</button>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading sign in…</div>}><LoginForm /></Suspense>;
}
