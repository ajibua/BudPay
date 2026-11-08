'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { ProtectedPage } from '@/components/AuthProvider';

interface WorkLog {
  id: string;
  personId: string;
  personName: string;
  personRole: string;
  workDate: string;
  task: string;
  hours: number;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string;
  submittedAt: string;
  reviewedAt: string | null;
}

function localDateValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function HoursContent() {
  const { role } = useAuth();
  const isBoss = role === 'boss';
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [workDate, setWorkDate] = useState(localDateValue);
  const [task, setTask] = useState('');
  const [hours, setHours] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyLogId, setBusyLogId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshLogs = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = isBoss ? '/api/work-logs' : '/api/crew/work-logs';
      const response = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${endpoint}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.data)) throw new Error(result.error || 'Could not load work logs.');
      setLogs(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load work logs.');
    } finally {
      setLoading(false);
    }
  }, [isBoss, role]);

  useEffect(() => { void refreshLogs(); }, [refreshLogs]);

  const submitLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/crew/work-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDate, task, hours: Number(hours), details }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit your work log.');
      setTask('');
      setHours('');
      setDetails('');
      setNotice('Your hours were sent to the boss for review.');
      await refreshLogs();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your work log.');
    } finally {
      setSaving(false);
    }
  };

  const reviewLog = async (logId: string, status: 'approved' | 'rejected') => {
    setBusyLogId(logId);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/work-logs/${encodeURIComponent(logId)}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not review this work log.');
      setNotice(`Work log ${status}.`);
      await refreshLogs();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not review this work log.');
    } finally {
      setBusyLogId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {isBoss ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {isBoss ? 'Boss review' : 'Crew hours'}
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">{isBoss ? 'Crew work logs' : 'Log your work hours'}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {isBoss
              ? 'Review each crew member’s submitted hours. Approved entries remain visible to the crew member who sent them.'
              : 'Send your task and hours to the boss as a claim. The boss reviews every entry before it is accepted.'}
          </p>
        </div>
        <button type="button" onClick={() => void refreshLogs()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}

      {!isBoss && (
        <form onSubmit={submitLog} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-extrabold text-slate-900">New work entry</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Work date
              <input type="date" required max={localDateValue()} value={workDate} onChange={event => setWorkDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900" />
            </label>
            <label className="text-xs font-bold text-slate-600">Hours worked
              <input type="number" required min="0.01" max="24" step="0.01" value={hours} onChange={event => setHours(event.target.value)} placeholder="e.g. 4.5" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900" />
            </label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Task completed
              <input type="text" required maxLength={160} value={task} onChange={event => setTask(event.target.value)} placeholder="e.g. Hemmed 3 pairs of trousers" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900" />
            </label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Details for the boss <span className="font-normal normal-case text-slate-400">(optional)</span>
              <textarea rows={3} maxLength={1000} value={details} onChange={event => setDetails(event.target.value)} placeholder="Add any useful context about the work." className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            <Send className="h-4 w-4" />{saving ? 'Sending…' : 'Submit hours for review'}
          </button>
        </form>
      )}

      <section className="space-y-4" aria-labelledby="work-log-list-heading">
        <div className="flex items-center justify-between">
          <h2 id="work-log-list-heading" className="text-lg font-extrabold text-slate-900">{isBoss ? 'All submissions' : 'Your submissions'}</h2>
          <span className="text-xs font-semibold text-slate-500">{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading work logs…</p> : logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{isBoss ? 'No crew hours have been submitted yet.' : 'Your submitted work entries will appear here.'}</p>
        ) : logs.map(log => (
          <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{log.task}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isBoss && <><span className="font-semibold text-slate-700">{log.personName}</span> · </>}
                  {log.personRole && isBoss ? `${log.personRole} · ` : ''}{log.workDate} · {log.hours} {log.hours === 1 ? 'hour' : 'hours'}
                </p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${log.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : log.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                {log.status}
              </span>
            </div>
            {log.details && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{log.details}</p>}
            {log.reviewNote && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-bold text-slate-700">Boss note: </span>{log.reviewNote}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-400">Submitted {new Date(log.submittedAt).toLocaleString()}</span>
              {isBoss && log.status === 'pending' && (
                <div className="flex gap-2">
                  <button type="button" disabled={busyLogId === log.id} onClick={() => void reviewLog(log.id, 'rejected')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                  <button type="button" disabled={busyLogId === log.id} onClick={() => void reviewLog(log.id, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function HoursPage() {
  return <ProtectedPage allowedRoles={['boss', 'crew']}><HoursContent /></ProtectedPage>;
}
