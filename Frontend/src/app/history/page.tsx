'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, ShieldCheck, CheckCircle2, Clock, AlertCircle, RefreshCw, ArrowRight, ExternalLink, WalletCards, LoaderCircle } from 'lucide-react';
import { apiFetch } from '@/lib/supabase';
import { ProtectedPage } from '@/components/AuthProvider';

interface JobRecord {
  id: string;
  title: string;
  customerName: string;
  customerEmail: string;
  customerNotes: string;
  serviceId: string;
  customerStatus: 'not_applicable' | 'awaiting_payment' | 'paid' | 'in_progress' | 'completed';
  agencyName: string;
  rawStory: string;
  totalCustomerPaymentCents: number;
  materialCostsCents: number;
  bossShareCents: number;
  crewPileCents: number;
  status: string;
  paymentCaptured: boolean;
  paypalOrderId?: string;
  paypalPayeeMerchantId?: string | null;
  paypalPayoutBatchId?: string;
  createdAt: string;
}

interface AgencyPayPalStatus {
  configured: boolean;
  connected: boolean;
  merchantId: string | null;
  payoutsEnabled: boolean;
  connectedAt: string | null;
}

function HistoryContent() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [bookingStatusError, setBookingStatusError] = useState<string | null>(null);
  const [paypalStatus, setPaypalStatus] = useState<AgencyPayPalStatus | null>(null);
  const [paypalStatusError, setPaypalStatusError] = useState<string | null>(null);
  const [connectingPayPal, setConnectingPayPal] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/jobs`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setJobs(json.data);
      } else {
        throw new Error(json.error || 'Failed to load payout history');
      }
    } catch (err: any) {
      setError(err.message || 'Could not fetch history from backend');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayPalStatus = async () => {
    setPaypalStatusError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/paypal/agency/status`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not check the agency PayPal connection.');
      setPaypalStatus(result);
    } catch (err) {
      setPaypalStatusError(err instanceof Error ? err.message : 'Could not check the agency PayPal connection.');
    }
  };

  const connectedAccountJobs = paypalStatus?.merchantId
    ? jobs.filter(job => job.paypalPayeeMerchantId === paypalStatus.merchantId)
    : [];
  const capturedPaymentsCents = connectedAccountJobs.filter(job => job.serviceId && job.paymentCaptured)
    .reduce((total, job) => total + job.totalCustomerPaymentCents, 0);
  const sentCrewPayoutsCents = connectedAccountJobs.filter(job => job.status === 'sent')
    .reduce((total, job) => total + job.crewPileCents, 0);

  const connectPayPal = async () => {
    setConnectingPayPal(true);
    setPaypalStatusError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/paypal/agency/onboarding`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.actionUrl !== 'string') throw new Error(result.error || 'Could not start PayPal seller onboarding.');
      window.location.assign(result.actionUrl);
    } catch (err) {
      setPaypalStatusError(err instanceof Error ? err.message : 'Could not start PayPal seller onboarding.');
      setConnectingPayPal(false);
    }
  };

  const updateBookingStatus = async (job: JobRecord, status: 'in_progress' | 'completed') => {
    setUpdatingBookingId(job.id);
    setBookingStatusError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/marketplace/bookings/${encodeURIComponent(job.id)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Could not update booking progress.');
      setJobs(current => current.map(item => item.id === job.id ? { ...item, customerStatus: result.data.customerStatus } : item));
    } catch (err) {
      setBookingStatusError(err instanceof Error ? err.message : 'Could not update booking progress.');
    } finally {
      setUpdatingBookingId(null);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchPayPalStatus();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
            Audit Trail & History
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Agency Jobs & Payouts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            New customer bookings, captured payments, work stories, and PayPal Sandbox crew payouts.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchJobs}
          aria-label="Refresh job history"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          Refresh History
        </button>
      </div>

      <section aria-labelledby="agency-paypal-title" className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><WalletCards className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Agency payments</p>
              <h2 id="agency-paypal-title" className="mt-1 text-lg font-extrabold text-slate-900">PayPal Sandbox seller account</h2>
              {!paypalStatus && !paypalStatusError && <p className="mt-1 text-sm text-slate-600">Checking the agency connection…</p>}
              {paypalStatus?.connected && paypalStatus.payoutsEnabled && <p className="mt-1 text-sm leading-6 text-slate-600">Connected seller <span className="font-mono text-xs">{paypalStatus.merchantId}</span>. Marketplace payments and team payouts can use this agency&apos;s Sandbox account.</p>}
              {paypalStatus?.connected && !paypalStatus.payoutsEnabled && <p className="mt-1 text-sm leading-6 text-amber-800">Connected seller <span className="font-mono text-xs">{paypalStatus.merchantId}</span>, but PayPal has not confirmed crew payout permission. Finish the PayPal permissions step before accepting bookings.</p>}
              {paypalStatus && !paypalStatus.connected && paypalStatus.configured && <p className="mt-1 text-sm leading-6 text-slate-600">Connect an agency-owned PayPal Sandbox account before taking marketplace payments. This also requests permission for BudPay to send crew payouts from that agency account.</p>}
              {paypalStatus && !paypalStatus.configured && <p className="mt-1 text-sm leading-6 text-slate-600">Connected-seller routing is waiting for PayPal platform settings. Current Sandbox checkout remains on BudPay&apos;s configured merchant account.</p>}
            </div>
          </div>
          {paypalStatus?.configured && (!paypalStatus.connected || !paypalStatus.payoutsEnabled) && <button type="button" onClick={() => void connectPayPal()} disabled={connectingPayPal} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{connectingPayPal ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{connectingPayPal ? 'Opening PayPal…' : paypalStatus.connected ? 'Finish PayPal permissions' : 'Connect PayPal seller'}</button>}
        </div>
        {paypalStatusError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{paypalStatusError}</p>}
      </section>

      {paypalStatus?.connected && <section aria-label="Agency PayPal payment totals" className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Captured marketplace payments</p><p className="mt-1 text-2xl font-black text-slate-900">${(capturedPaymentsCents / 100).toFixed(2)}</p><p className="mt-1 text-xs leading-5 text-slate-500">Recorded against this connected agency Sandbox account.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crew payouts sent</p><p className="mt-1 text-2xl font-black text-emerald-700">${(sentCrewPayoutsCents / 100).toFixed(2)}</p><p className="mt-1 text-xs leading-5 text-slate-500">PayPal Sandbox batches submitted from this agency account.</p></div>
      </section>}

      {loading ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading jobs from backend...
        </div>
      ) : error ? (
        <div role="alert" className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-500 text-sm space-y-3">
          <p className="font-semibold text-slate-800 text-base">No payouts recorded yet.</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Once you calculate a fair split and approve it, the job receipt and batch status will appear here.
          </p>
          <Link
            href="/split"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition"
          >
            Start Your First Split
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookingStatusError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{bookingStatusError}</p>}
          {jobs.map(job => (
            <article
              key={job.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4 hover:border-blue-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{job.title || 'Fair Pay Job'}</h2>
                  <p className="text-xs text-slate-400">
                    Created {new Date(job.createdAt || Date.now()).toLocaleDateString()} at{' '}
                    {new Date(job.createdAt || Date.now()).toLocaleTimeString()}
                  </p>
                  {job.agencyName && <p className="mt-1 text-xs font-medium text-slate-500">{job.agencyName}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {job.paymentCaptured && job.status === 'draft' && <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">New paid booking</span>}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${job.status === 'sent'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : job.status === 'approved'
                          ? 'bg-blue-50 text-blue-800 border border-blue-300'
                          : 'bg-amber-50 text-amber-800 border border-amber-300'
                      }`}
                  >
                    {job.status}
                  </span>
                </div>
              </div>

              {job.customerName && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Customer booking {job.serviceId ? `· ${job.title}` : ''}</p>
                  <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-slate-900">{job.customerName}</span>
                    <a href={`mailto:${job.customerEmail}`} className="font-medium text-blue-800 underline underline-offset-2">{job.customerEmail}</a>
                  </div>
                  {job.customerNotes && <p className="mt-2 border-t border-blue-100 pt-2 text-xs leading-5 text-slate-600">{job.customerNotes}</p>}
                </div>
              )}

              {job.serviceId && job.paymentCaptured && (
                <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Customer progress</p>
                    <p className="mt-1 text-sm font-bold capitalize text-slate-900">{(job.customerStatus || 'paid').replace(/_/g, ' ')}</p>
                  </div>
                  {job.customerStatus === 'paid' && <button type="button" onClick={() => updateBookingStatus(job, 'in_progress')} disabled={updatingBookingId === job.id} className="rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60">{updatingBookingId === job.id ? 'Saving…' : 'Mark work started'}</button>}
                  {job.customerStatus === 'in_progress' && <button type="button" onClick={() => updateBookingStatus(job, 'completed')} disabled={updatingBookingId === job.id} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{updatingBookingId === job.id ? 'Saving…' : 'Mark service complete'}</button>}
                </div>
              )}

              {job.serviceId && job.paymentCaptured && job.status === 'draft' && (
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-amber-900">Payment is confirmed. Review the work story and calculate the team&apos;s fair share when the job is complete.</p>
                  <Link href={`/split?jobId=${encodeURIComponent(job.id)}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800">Prepare team split <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
              )}

              {job.rawStory && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
                  &ldquo;{job.rawStory}&rdquo;
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Customer Paid</span>
                  <span className="font-extrabold text-sm text-slate-900">
                    ${((job.totalCustomerPaymentCents || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Material Costs</span>
                  <span className="font-extrabold text-sm text-slate-900">
                    ${((job.materialCostsCents || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Boss Share</span>
                  <span className="font-extrabold text-sm text-blue-700">
                    ${((job.bossShareCents || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Crew Pile Split</span>
                  <span className="font-extrabold text-sm text-emerald-700">
                    ${((job.crewPileCents || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {job.paypalPayoutBatchId && (
                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>PayPal Batch: {job.paypalPayoutBatchId}</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    Delivered via PayPal Sandbox
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return <ProtectedPage allowedRoles={['boss']}><HistoryContent /></ProtectedPage>;
}
