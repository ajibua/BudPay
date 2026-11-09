'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, ChevronDown, Clock3, LoaderCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/supabase';

type Service = {
  id: string;
  agencyId: string;
  agencyName: string;
  category: string;
  title: string;
  description: string;
  priceCents: number;
  turnaround: string;
  initials: string;
};

type Checkout = {
  bookingId: string;
  orderId: string;
  approvalUrl: string;
  service: Service;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const formatPrice = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function MarketplacePage() {
  const { role } = useAuth();
  const bookingStartInFlight = useRef(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [publishingService, setPublishingService] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');
  const [serviceDraft, setServiceDraft] = useState({ title: '', category: '', description: '', price: '', turnaround: '' });

  useEffect(() => {
    fetch(`${API_URL}/api/marketplace/services`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Could not load services.');
        setServices(Array.isArray(result.data) ? result.data : []);
      })
      .catch(err => setError(err.message || 'Could not load services.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const bookingId = params.get('bookingId');
    if (payment === 'cancel' && bookingId) {
      setNotice('Payment was cancelled. Your booking was not charged. You can start checkout again from the service listing.');
      window.history.replaceState({}, '', '/marketplace');
      return;
    }
    if (payment !== 'return' || !bookingId) return;

    const paypalToken = params.get('token') || '';
    setBusy(true);
    fetch(`${API_URL}/api/marketplace/bookings/${encodeURIComponent(bookingId)}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paypalToken })
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success || result.status !== 'COMPLETED' || !result.booking) {
        throw new Error(result.error || 'We could not confirm the PayPal payment yet.');
      }
      const booking = result.booking;
      setCheckout({
        bookingId: booking.id,
        orderId: paypalToken,
        approvalUrl: '',
        service: {
          id: '', agencyId: '', category: '', description: '', turnaround: '', initials: '',
          title: booking.title,
          agencyName: booking.agencyName,
          priceCents: booking.totalCustomerPaymentCents
        }
      });
      setComplete(true);
      window.history.replaceState({}, '', '/marketplace');
  }).catch(err => setNotice(`${err instanceof Error ? err.message : 'Could not confirm your payment.'} Your booking reference is ${bookingId}; use it to track the booking or retry confirmation from your checkout tab.`))
      .finally(() => setBusy(false));
  }, []);

  const startBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || bookingStartInFlight.current) return;
    bookingStartInFlight.current = true;
    setError('');
    setBusy(true);
    const approvalWindow = window.open('', '_blank');
    try {
      const response = await fetch(`${API_URL}/api/marketplace/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: selected.id, customerName, customerEmail, notes })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.bookingId || !result.orderId || !result.approvalUrl) {
        throw new Error(result.error || 'Could not start checkout.');
      }
      const nextCheckout = { bookingId: result.bookingId, orderId: result.orderId, approvalUrl: result.approvalUrl, service: selected };
      setCheckout(nextCheckout);
      if (approvalWindow) {
        approvalWindow.opener = null;
        approvalWindow.location.href = result.approvalUrl;
      }
    } catch (err) {
      approvalWindow?.close();
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
    } finally {
      bookingStartInFlight.current = false;
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!checkout) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/marketplace/bookings/${encodeURIComponent(checkout.bookingId)}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalToken: checkout.orderId })
      });
      const result = await response.json();
      if (!response.ok || !result.success || result.status !== 'COMPLETED') {
        throw new Error(result.error || 'Payment is not confirmed yet.');
      }
      setComplete(true);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Could not confirm payment.'} Your booking is saved with reference ${checkout.bookingId}. You can retry confirmation here.`);
    } finally {
      setBusy(false);
    }
  };

  const publishService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPublishingService(true);
    setPublishError('');
    try {
      const response = await apiFetch(`${API_URL}/api/marketplace/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serviceDraft, price: Number(serviceDraft.price) })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.id) {
        throw new Error(result.error || 'Could not publish this service.');
      }
      setServices(current => [result.data, ...current.filter(service => service.id !== result.data.id)]);
      setPublishSuccess(`${result.data.title} is now listed in your marketplace.`);
      setServiceDraft({ title: '', category: '', description: '', price: '', turnaround: '' });
      setCreateServiceOpen(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not publish this service.');
    } finally {
      setPublishingService(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-[#f7f8fa] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> BudPay home</Link>
          <Link href="/booking" className="text-sm font-bold text-blue-700 hover:text-blue-900">Track a booking</Link>
        </div>
        {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{notice}</p>}
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-12 sm:py-14">
          <div className="absolute -right-12 -top-28 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
          <div className="relative max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"><Sparkles className="h-3.5 w-3.5" /> Services from skilled teams</span>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Find a team.<br /><span className="text-blue-300">Get great work done.</span></h1>
            <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Book a service and pay securely with BudPay. The agency takes it from there, coordinating the people who make the work happen.</p>
            <p className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">No customer account needed to browse or book.</p>
          </div>
        </section>

        {complete && checkout ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm sm:p-10" role="status">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Payment confirmed</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Your booking is with the agency.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{checkout.service.agencyName} received your {checkout.service.title.toLowerCase()} request. The agency coordinates the work and its crew payouts in BudPay.</p>
            <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><span className="text-xs text-slate-500">Service</span><p className="mt-1 font-semibold text-slate-900">{checkout.service.title}</p></div>
              <div><span className="text-xs text-slate-500">Paid</span><p className="mt-1 font-semibold text-slate-900">{formatPrice(checkout.service.priceCents)}</p></div>
              <div className="sm:col-span-2"><span className="text-xs text-slate-500">Booking reference</span><p className="mt-1 break-all font-mono text-xs text-slate-700">{checkout.bookingId}</p></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/booking?reference=${encodeURIComponent(checkout.bookingId)}`} className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">View booking status</Link>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(checkout.bookingId); }} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Copy booking reference</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Save this booking reference and use the email you entered to check progress later.</p>
          </section>
        ) : checkout ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-blue-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><ShieldCheck className="h-6 w-6" /></div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Secure checkout</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Approve your payment with PayPal</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Approve the payment in PayPal. BudPay will verify and capture it when PayPal returns you here. If you came back to this tab, use the button below to check again.</p>
            <a href={checkout.approvalUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">Open PayPal approval <ArrowRight className="h-4 w-4" /></a>
            <button type="button" onClick={confirmPayment} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? 'Confirming payment…' : 'I approved it — confirm payment'}</button>
            {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-700">{error}</p>}
          </section>
        ) : (
          <>
            <section aria-labelledby="customer-journey-title" className="space-y-5">
              <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-widest text-blue-700">A simple customer journey</p><h2 id="customer-journey-title" className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">From finding a team to following the work.</h2><p className="mt-3 text-sm leading-6 text-slate-600">Choose a service, tell the agency what you need, and pay online. The company coordinates its crew and keeps you updated on the booking.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['01', 'Find the right company', 'Explore agency profiles and work samples, then compare the services they offer.'],
                  ['02', 'Explain what you need', 'Choose a service and share your contact details plus any useful project notes.'],
                  ['03', 'Pay for the service', 'Approve the PayPal Sandbox payment. BudPay verifies it and gives you a booking reference.'],
                  ['04', 'Follow your booking', 'Use your reference and checkout email to check progress while the agency does the work.']
                ].map(([number, title, description]) => <article key={number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-black tracking-widest text-blue-700">{number}</span><h3 className="mt-2 text-base font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}
              </div>
            </section>

            <section className="space-y-5" aria-labelledby="services-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">The marketplace</p><h2 id="services-title" className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Browse services</h2></div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate-500">A clear price. A real team. One checkout.</span>
                  {role === 'boss' && <button type="button" onClick={() => { setCreateServiceOpen(true); setPublishError(''); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800"><Plus className="h-4 w-4" /> Create service</button>}
                </div>
              </div>
              {publishSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{publishSuccess}</p>}
              {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading services…</div> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : (
                <div className="grid gap-5 md:grid-cols-2">
                  {services.map(service => (
                    <article key={service.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className={`flex h-40 items-end bg-gradient-to-br ${service.id === 'tailored-outfit' ? 'from-amber-100 to-orange-200' : 'from-rose-100 to-pink-200'} p-5`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-sm font-black text-slate-800 shadow-sm">{service.initials}</div></div>
                      <div className="space-y-4 p-5 sm:p-6">
                        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">{service.category}</p><h3 className="mt-1 text-xl font-extrabold text-slate-900">{service.title}</h3><p className="mt-1 text-sm font-medium text-slate-500">by {service.agencyName}</p><Link href={`/agency?agencyId=${encodeURIComponent(service.agencyId)}`} className="mt-2 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">View agency profile <ArrowRight className="ml-1 h-4 w-4" /></Link><p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p></div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-2xl font-black text-slate-900">{formatPrice(service.priceCents)}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{service.turnaround}</p></div><button type="button" onClick={() => { setSelected(service); setError(''); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Book service <ArrowRight className="h-4 w-4" /></button></div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section aria-labelledby="marketplace-faq-title" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Frequently asked questions</p><h2 id="marketplace-faq-title" className="mt-1 text-xl font-extrabold text-slate-900">FAQs</h2><p className="mt-2 text-sm leading-6 text-slate-600">Quick answers about booking, payment, and working with an agency.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 open:bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><span>Do I need to create an account?</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-3 pr-7 text-sm leading-6 text-slate-600">No. You can browse, book, and pay as a guest. The sign-in link is for agency owners and their crew.</p>
                </details>
                <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 open:bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><span>What do I do after PayPal?</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-3 pr-7 text-sm leading-6 text-slate-600">PayPal returns you to BudPay, which verifies and captures the payment. You will see a booking reference and a link to check progress.</p>
                </details>
                <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 open:bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><span>Will I get an email receipt or progress updates?</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-3 pr-7 text-sm leading-6 text-slate-600">Email updates are not available yet. Save your booking reference and check the marketplace using the same email you entered at checkout.</p>
                </details>
                <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 open:bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><span>Can I see how the agency splits the money?</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-3 pr-7 text-sm leading-6 text-slate-600">The agency handles crew hours and payout decisions in its private workspace. Your booking is for the service provided by the company.</p>
                </details>
              </div>
            </section>
          </>
        )}
      </div>

      {selected && !checkout && !complete && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Book with {selected.agencyName}</p><h2 id="booking-title" className="mt-1 text-2xl font-extrabold text-slate-900">{selected.title}</h2><p className="mt-2 text-sm text-slate-500">{formatPrice(selected.priceCents)} · Pay securely with PayPal</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close booking form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">×</button></div>
          <form onSubmit={startBooking} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Your name<input required minLength={2} maxLength={100} autoComplete="name" value={customerName} onChange={event => setCustomerName(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Email for the agency to contact you<input type="email" required maxLength={255} autoComplete="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">What should the team know? <span className="font-normal text-slate-400">Optional</span><textarea maxLength={1000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            {error && <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BriefcaseBusiness className="h-4 w-4" />}{busy ? 'Preparing secure checkout…' : `Continue to payment · ${formatPrice(selected.priceCents)}`}</button>
            <p className="text-center text-xs leading-5 text-slate-500">Your details go to the agency for this booking. BudPay only confirms payment and helps the agency manage fair team payouts.</p>
          </form>
        </section>
      </div>}

      {createServiceOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !publishingService) setCreateServiceOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="create-service-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Agency workspace</p>
          <h2 id="create-service-title" className="mt-1 text-2xl font-extrabold text-slate-900">Create a service listing</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Set the offer customers will see. The service price is saved with this agency and used to create its PayPal checkout.</p>
          <form onSubmit={publishService} className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Service name<input required minLength={3} maxLength={120} value={serviceDraft.title} onChange={event => setServiceDraft(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Bridal dress alterations" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Category<input required minLength={2} maxLength={100} value={serviceDraft.category} onChange={event => setServiceDraft(current => ({ ...current, category: event.target.value }))} placeholder="e.g. Fashion & Tailoring" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Description<textarea required minLength={20} maxLength={1000} rows={3} value={serviceDraft.description} onChange={event => setServiceDraft(current => ({ ...current, description: event.target.value }))} placeholder="What will the customer receive?" className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Fixed price (USD)<input type="number" required min="0.01" step="0.01" value={serviceDraft.price} onChange={event => setServiceDraft(current => ({ ...current, price: event.target.value }))} placeholder="75.00" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Typical turnaround<input required minLength={2} maxLength={80} value={serviceDraft.turnaround} onChange={event => setServiceDraft(current => ({ ...current, turnaround: event.target.value }))} placeholder="3–5 days" className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            </div>
            {publishError && <p role="alert" className="text-sm font-medium text-rose-700">{publishError}</p>}
            <button type="submit" disabled={publishingService} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{publishingService ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{publishingService ? 'Publishing service…' : 'Publish service'}</button>
          </form>
        </section>
      </div>}
    </div>
  );
}
