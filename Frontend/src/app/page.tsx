'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, HeartHandshake, Sparkles } from 'lucide-react';

interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  timestamp: string;
}

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkBackend = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/health`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setBackendHealth(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to reach backend kitchen');
      setBackendHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="w-full border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            B
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">BudPay</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              PayPal AI Hackathon
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sandbox Mode
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          The Fair Pay Helper
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 max-w-2xl leading-tight">
          PayPal moves the money. <br />
          <span className="text-blue-600">BudPay</span> helps the boss decide what is fair.
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl">
          Got paid in a lump sum? Tell BudPay what your crew did in your own words.
          Gemini extracts the work, BudPay calculates the fair split to the exact cent, and PayPal pays everyone at once.
        </p>

        {/* Milestone 1 Status Card */}
        <div className="mt-10 w-full max-w-lg bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="font-semibold text-slate-900 text-base">Day 1 Connection Check</h2>
              <p className="text-xs text-slate-500">Checking communication between Dining Room (Next.js) & Kitchen (Express.js)</p>
            </div>
            <button
              onClick={checkBackend}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Refresh connection"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Frontend (Next.js)</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Ready
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Backend (Express.js)</span>
              {loading ? (
                <span className="text-amber-500 text-xs font-medium">Pinging localhost:5000...</span>
              ) : backendHealth ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Connected ({backendHealth.status})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-500 font-medium text-xs">
                  <AlertCircle className="w-4 h-4" /> {error || 'Offline'}
                </span>
              )}
            </div>

            {backendHealth && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 text-xs text-slate-600 border border-slate-100 space-y-1">
                <div><strong>Backend:</strong> {backendHealth.app}</div>
                <div><strong>Env:</strong> {backendHealth.environment}</div>
                <div><strong>Server Time:</strong> {new Date(backendHealth.timestamp).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* 6 Steps Preview */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left text-sm">
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">1. Tell the Story</div>
            <p className="text-xs text-slate-500">Boss describes who did what in plain words. Gemini extracts hours & roles.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">2. Slices & Sliders</div>
            <p className="text-xs text-slate-500">Points = hours × weight. Boss adjusts sliders. Code enforces 100% exact penny match.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">3. One-Click Payout</div>
            <p className="text-xs text-slate-500">PayPal Payouts batch sends money + thank-you note to every crew member instantly.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400">
        BudPay &bull; Built for PayPal AI Hackathon (Nov 2026)
      </footer>
    </div>
  );
}
