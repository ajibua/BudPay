'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, ShieldCheck, CheckCircle2, Clock, AlertCircle, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';

interface JobRecord {
  id: string;
  title: string;
  rawStory: string;
  totalCustomerPaymentCents: number;
  materialCostsCents: number;
  bossShareCents: number;
  crewPileCents: number;
  status: string;
  paypalOrderId?: string;
  paypalPayoutBatchId?: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/jobs`);
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

  useEffect(() => {
    fetchJobs();
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
            Payout & Split History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete record of customer payments, story snapshots, and PayPal Sandbox batch payouts.
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
                </div>
                <div className="flex items-center gap-2">
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
