'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, LoaderCircle, Store } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
type Agency = { id: string; name: string; slug: string };

export default function AgenciesPage() {
  const { role, agencyId } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/marketplace/agencies`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Could not load agencies.');
        setAgencies(Array.isArray(result.data) ? result.data : []);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load agencies.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-[80vh] bg-slate-50 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-12 sm:py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"><Store className="h-4 w-4" /> The people behind the services</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Discover an agency for the work you have in mind.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Every agency has its own profile, services, and team workspace. Explore what a company does and view the work samples it shares, then head to the marketplace to book a service that fits your needs.</p>
          <Link href="/marketplace" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-blue-50">Browse services <ArrowRight className="h-4 w-4" /></Link>
        </section>

        <section aria-labelledby="agency-directory-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Agency directory</p><h2 id="agency-directory-title" className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Meet the companies on BudPay</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Visit a profile to read the agency story and browse project examples submitted by its team.</p></div>
            {role === 'boss' && agencyId ? <Link href={`/agency?agencyId=${encodeURIComponent(agencyId)}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-blue-300 hover:text-blue-800">Manage your agency profile <ArrowRight className="h-4 w-4" /></Link> : role !== 'crew' && <Link href="/login?mode=signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"><BriefcaseBusiness className="h-4 w-4" /> Create an agency</Link>}
          </div>

          {loading ? <div className="mt-6 flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading agencies</div> : error ? <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</p> : agencies.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Store className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold text-slate-900">No agencies listed yet</h3><p className="mt-1 text-sm text-slate-600">Companies can create an account and set up their own agency workspace.</p></div> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{agencies.map(agency => <article key={agency.id} className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BriefcaseBusiness className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-extrabold text-slate-900">{agency.name}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">Explore this company&apos;s story, services, and selected work.</p><Link href={`/agency?agencyId=${encodeURIComponent(agency.id)}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">View agency profile <ArrowRight className="h-4 w-4" /></Link></article>)}</div>}
        </section>

        <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 sm:grid-cols-2 sm:p-8">
          <article><p className="text-xs font-bold uppercase tracking-widest text-blue-700">For customers</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Bring the work you need done.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Find a company with a service that fits, share the details that matter, and book without creating a customer account.</p></article>
          <article><p className="text-xs font-bold uppercase tracking-widest text-blue-700">For companies</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Give your team its own workspace.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create an agency profile, publish services, add your crew, and manage bookings and fair-share payouts inside your agency account.</p></article>
        </section>
      </div>
    </main>
  );
}
