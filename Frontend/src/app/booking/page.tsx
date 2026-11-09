'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Search } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type Booking = {
  id: string;
  title: string;
  agencyName: string;
  totalCustomerPaymentCents: number;
  customerStatus: 'awaiting_payment' | 'paid' | 'in_progress' | 'completed';
  paymentCaptured: boolean;
  createdAt: string;
};

const steps = [
  { id: 'paid', label: 'Payment confirmed', detail: 'The agency has your booking.' },
  { id: 'in_progress', label: 'Work in progress', detail: 'The agency is working on your service.' },
  { id: 'completed', label: 'Completed', detail: 'The agency marked the service complete.' }
] as const;

const formatPrice = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function BookingPage() {
  const [bookingId, setBookingId] = useState('');
  const [email, setEmail] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (reference) setBookingId(reference);
  }, []);

  const lookupBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setBooking(null);
    try {
      const response = await fetch(`${API_URL}/api/marketplace/bookings/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingId.trim(), customerEmail: email.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'We could not find a booking with those details.');
      }
      setBooking(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up your booking.');
    } finally {
      setBusy(false);
    }
  };

  const completedSteps = booking?.customerStatus === 'awaiting_payment'
    ? 0
    : steps.findIndex(step => step.id === booking?.customerStatus) + 1;

  return (
    <main className="min-h-[80vh] bg-[#f7f8fa] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Marketplace</Link>

        <section className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Guest booking lookup</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Check your booking</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Enter the booking reference from your confirmation and the email address you gave the agency. No account is needed.</p>
        </section>

        <form onSubmit={lookupBooking} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Booking reference
            <input required value={bookingId} onChange={event => setBookingId(event.target.value)} autoComplete="off" placeholder="Paste your booking reference" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-mono text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Booking email
            <input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy ? 'Looking up booking…' : 'Find my booking'}
          </button>
        </form>

        {booking && <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Booking found</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">{booking.title}</h2>
              <p className="mt-1 text-sm text-slate-500">with {booking.agencyName}</p>
            </div>
            <p className="shrink-0 text-sm font-extrabold text-slate-900">{formatPrice(booking.totalCustomerPaymentCents)}</p>
          </div>

          {booking.customerStatus === 'awaiting_payment' ? (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Payment has not been confirmed yet. If you just approved PayPal, return to the checkout tab and confirm the payment.</p>
            </div>
          ) : <ol className="space-y-0">
            {steps.map((step, index) => {
              const reached = index < completedSteps;
              const current = index === completedSteps - 1;
              return <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[15px] top-8 h-full w-px ${index < completedSteps - 1 ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${reached ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {reached ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </span>
                <span className="pt-0.5">
                  <span className={`block text-sm font-bold ${current ? 'text-blue-800' : reached ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}{current ? ' · Current' : ''}</span>
                  <span className="mt-1 block text-xs text-slate-500">{step.detail}</span>
                </span>
              </li>;
            })}
          </ol>}

          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
            <p>Reference: <span className="break-all font-mono text-slate-700">{booking.id}</span></p>
            <p className="mt-1">Booked {new Date(booking.createdAt).toLocaleDateString()}</p>
          </div>
        </section>}
      </div>
    </main>
  );
}
