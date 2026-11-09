'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type PortfolioItem = { id: string; title: string; category: string; description: string; imageUrl: string; createdAt: string };
type AgencyProfile = { agencyId: string; agencyName: string; tagline: string; story: string; portfolio: PortfolioItem[] };
type ApiResult<T> = { success: boolean; data?: T; error?: string };

async function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

export default function AgencyPage() {
  const { role, agencyId: currentAgencyId } = useAuth();
  const [profileAgencyId, setProfileAgencyId] = useState('tundestudio');
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [tagline, setTagline] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWork, setSavingWork] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draft, setDraft] = useState({ title: '', category: '', description: '' });
  const [image, setImage] = useState<File | null>(null);

  async function loadProfile(agencyId: string) {
    const response = await fetch(`${API_URL}/api/marketplace/agency-profile?agencyId=${encodeURIComponent(agencyId)}`);
    const result = await response.json() as ApiResult<AgencyProfile>;
    if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Could not load the agency profile.');
    setProfile(result.data);
    setTagline(result.data.tagline);
    setStory(result.data.story);
  }

  useEffect(() => {
    const agencyId = new URLSearchParams(window.location.search).get('agencyId') || 'tundestudio';
    setProfileAgencyId(agencyId);
    loadProfile(agencyId).catch(err => setError(err.message || 'Could not load the agency profile.')).finally(() => setLoading(false));
  }, []);

  const canManageAgency = role === 'boss' && currentAgencyId === profileAgencyId;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true); setError(''); setSuccess('');
    try {
      const response = await apiFetch(`${API_URL}/api/marketplace/agency-profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagline, story })
      });
      const result = await response.json() as ApiResult<Omit<AgencyProfile, 'portfolio'>>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Could not save the profile.');
      setProfile(current => current ? { ...current, ...result.data } : current);
      setSuccess('Agency story saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the profile.'); }
    finally { setSavingProfile(false); }
  }

  async function addWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) { setError('Choose a project image first.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 2 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP image no larger than 2 MB.'); return;
    }
    setSavingWork(true); setError(''); setSuccess('');
    try {
      const imageData = await readAsBase64(image);
      const response = await apiFetch(`${API_URL}/api/marketplace/portfolio`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...draft, mimeType: image.type, imageData })
      });
      const result = await response.json() as ApiResult<PortfolioItem>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Could not add this project.');
      setProfile(current => current ? { ...current, portfolio: [result.data!, ...current.portfolio] } : current);
      setDraft({ title: '', category: '', description: '' }); setImage(null);
      const input = document.getElementById('portfolio-image') as HTMLInputElement | null;
      if (input) input.value = '';
      setSuccess('Project added to the portfolio.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add this project.'); }
    finally { setSavingWork(false); }
  }

  async function removeWork(item: PortfolioItem) {
    if (!window.confirm(`Remove “${item.title}” from the public portfolio?`)) return;
    setRemovingId(item.id); setError(''); setSuccess('');
    try {
      const response = await apiFetch(`${API_URL}/api/marketplace/portfolio/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not remove this project.');
      setProfile(current => current ? { ...current, portfolio: current.portfolio.filter(project => project.id !== item.id) } : current);
      setSuccess('Project removed.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove this project.'); }
    finally { setRemovingId(''); }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
        {loading ? <div className="flex min-h-72 items-center justify-center text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Loading agency profile</div> : !profile ? <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error || 'Agency profile is unavailable.'}</div> : <>
          <section className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-7 py-10 text-white sm:px-12 sm:py-14">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100"><BriefcaseBusiness className="h-3.5 w-3.5" /> Meet the agency</span>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">{profile.agencyName}</h1>
              <p className="mt-3 text-xl font-semibold text-blue-200">{profile.tagline}</p>
              <p className="mt-6 max-w-2xl whitespace-pre-line text-base leading-8 text-slate-200">{profile.story}</p>
              <Link href="/marketplace" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-blue-50">Browse services <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-sm font-bold uppercase tracking-wider text-blue-700">Selected work</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">A look at what the team makes</h2><p className="mt-2 max-w-2xl text-slate-600">Browse project photos and notes shared by the agency to see its style and the kind of work it takes on.</p></div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">Agency-submitted examples · not independently verified</span>
            </div>
            {profile.portfolio.length ? <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{profile.portfolio.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.imageUrl} alt={`${item.title}, shared by ${profile.agencyName}`} className="h-56 w-full bg-slate-100 object-cover" />
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{item.category}</p><h3 className="mt-1 text-lg font-bold">{item.title}</h3></div>{canManageAgency && <button type="button" title="Remove project" disabled={removingId === item.id} onClick={() => removeWork(item)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>}</div><p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p></div>
            </article>)}</div> : <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><ImagePlus className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold">The portfolio is taking shape</h3><p className="mt-1 text-sm text-slate-600">The agency has not added any project examples yet.</p></div>}
          </section>

          {canManageAgency && <section className="mt-12 grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Edit agency story</h2><p className="mt-1 text-sm text-slate-600">Help customers understand who they will work with and how your team approaches a project.</p><label className="mt-5 block text-sm font-bold">Short tagline<input value={tagline} onChange={event => setTagline(event.target.value)} minLength={8} maxLength={120} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="mt-4 block text-sm font-bold">About the agency<textarea value={story} onChange={event => setStory(event.target.value)} minLength={40} maxLength={1800} required rows={6} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal leading-6 outline-none focus:border-blue-500" /></label><button disabled={savingProfile} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{savingProfile ? 'Saving…' : 'Save story'}</button></form>
            <form onSubmit={addWork} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Add a project example</h2><p className="mt-1 text-sm text-slate-600">Share a real image and a short description. Customers will see that the example was provided by the agency.</p><label className="mt-5 block text-sm font-bold">Project name<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} minLength={3} maxLength={120} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="mt-4 block text-sm font-bold">Category<input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} minLength={2} maxLength={100} required placeholder="e.g. Occasion wear" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="mt-4 block text-sm font-bold">What was done?<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} minLength={20} maxLength={500} required rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal leading-6 outline-none focus:border-blue-500" /></label><label className="mt-4 block text-sm font-bold">Project photo <span className="font-normal text-slate-500">(JPEG, PNG, WebP · up to 2 MB)</span><input id="portfolio-image" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => setImage(event.target.files?.[0] || null)} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-800" /></label><button disabled={savingWork} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><ImagePlus className="h-4 w-4" />{savingWork ? 'Uploading…' : 'Add to portfolio'}</button></form>
          </section>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {success && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
        </>}
      </div>
    </main>
  );
}
