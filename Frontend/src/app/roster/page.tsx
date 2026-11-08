'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, UserPlus, Mail, Award, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Pencil, UserMinus } from 'lucide-react';
import { apiFetch } from '@/lib/supabase';
import { ProtectedPage } from '@/components/AuthProvider';

interface SavedPerson {
  id: string;
  name: string;
  role: string;
  email: string;
  authEmail: string;
  defaultWeight: number;
}

function RosterContent() {
  const [people, setPeople] = useState<SavedPerson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New crew member form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [defaultWeight, setDefaultWeight] = useState<number>(1.5);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchPeople = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/people`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPeople(json.data);
      } else {
        throw new Error(json.error || 'Failed to load crew members');
      }
    } catch (err: any) {
      setError(err.message || 'Could not connect to crew database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiFetch(`${API_URL}/api/people${editingPersonId ? `/${encodeURIComponent(editingPersonId)}` : ''}`, {
        method: editingPersonId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim() || 'Crew Member',
          email: email.trim(),
          authEmail: authEmail.trim(),
          defaultWeight: Number(defaultWeight) || 1.5
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not add crew member');
      }

      setFormSuccess(editingPersonId
        ? `Updated ${json.person.name}'s crew details.`
        : `Added ${json.person.name} to the saved roster!`);
      setName('');
      setRole('');
      setEmail('');
      setAuthEmail('');
      setDefaultWeight(1.5);
      setEditingPersonId(null);
      setShowAddForm(false);
      fetchPeople();
    } catch (err: any) {
      setFormError(err.message || 'Error creating crew member');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingPerson = (person: SavedPerson) => {
    setEditingPersonId(person.id);
    setName(person.name);
    setRole(person.role);
    setEmail(person.email);
    setAuthEmail(person.authEmail || person.email);
    setDefaultWeight(person.defaultWeight);
    setFormError(null);
    setFormSuccess(null);
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingPersonId(null);
    setName('');
    setRole('');
    setEmail('');
    setAuthEmail('');
    setDefaultWeight(1.5);
    setFormError(null);
  };

  const deactivatePerson = async (person: SavedPerson) => {
    if (!window.confirm(`Remove ${person.name} from the active crew? This will block their next sign-in.`)) return;
    setDeactivatingId(person.id);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/people/${encodeURIComponent(person.id)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not remove this crew member.');
      setFormSuccess(`${person.name} was removed from the active crew. Their previous work logs are retained.`);
      await fetchPeople();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this crew member.');
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
            Dynamic Roster
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Saved Crew details
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your crew members, verified PayPal Sandbox payout emails, and baseline skill weights.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showAddForm) closeForm();
            else {
              closeForm();
              setShowAddForm(true);
            }
          }}
          aria-expanded={showAddForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          {showAddForm ? 'Close Form' : 'Add Crew Member'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleSavePerson}
          aria-label={editingPersonId ? 'Edit crew member' : 'Add new crew member'}
          className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"
        >
          <h2 className="text-xl font-bold text-slate-900">{editingPersonId ? 'Edit Crew Details' : 'Add New Crew'}</h2>

          {formError && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="person-name" className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Full Name *
              </label>
              <input
                id="person-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Amaka Okafor"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="person-role" className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Default Role
              </label>
              <input
                id="person-role"
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Tailoring / Finishing"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="person-email" className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                PayPal Sandbox Email *
              </label>
              <input
                id="person-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. sb-nzegj53708550@personal.example.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="person-auth-email" className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Crew sign-in email
              </label>
              <input
                id="person-auth-email"
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                placeholder="Leave blank to use the PayPal email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1.5 text-[11px] leading-4 text-slate-500">Use the email they will confirm in Supabase or Google. This can differ from their PayPal address.</p>
            </div>

            <div>
              <label htmlFor="person-weight" className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Default Skill Weight (1.0 - 2.5)
              </label>
              <select
                id="person-weight"
                value={defaultWeight}
                onChange={e => setDefaultWeight(parseFloat(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1.0}>1.0 &times; (Standard / Basic Tasks / Delivery)</option>
                <option value={1.5}>1.5 &times; (Core Skilled Labor / Assembly / Sewing)</option>
                <option value={2.0}>2.0 &times; (High Skill / Intricate Finishing)</option>
                <option value={2.5}>2.5 &times; (Master Artisan / Specialist)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Saving Crew Member...' : editingPersonId ? 'Save Changes' : 'Save to Roster'}
            </button>
          </div>
        </form>
      )}

      {formSuccess && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Roster Cards List */}
      <section aria-labelledby="active-roster-heading" className="space-y-4">
        <h2 id="active-roster-heading" className="text-xl font-bold text-slate-900 flex items-center justify-between">
          <span>Active Crew ({people.length})</span>
          <button
            type="button"
            onClick={fetchPeople}
            aria-label="Refresh roster list"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </h2>

        {loading ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading dynamic crew details from backend API...
          </div>
        ) : error ? (
          <div role="alert" className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : people.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-500 text-sm">
            No crew saved yet. Click &ldquo;Add Crew&rdquo; above to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {people.map(person => (
              <div
                key={person.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-sm">
                    {person.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {person.defaultWeight}&times; Skill Weight
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditingPerson(person)}
                      aria-label={`Edit ${person.name}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deactivatePerson(person)}
                      disabled={deactivatingId === person.id}
                      aria-label={`Remove ${person.name} from active crew`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                      {deactivatingId === person.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">{person.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{person.role}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600 font-mono break-all">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                  <span>{person.email}</span>
                </div>
                {person.authEmail && person.authEmail.toLowerCase() !== person.email.toLowerCase() && (
                  <p className="text-[11px] text-slate-500">Crew login: <span className="font-medium text-slate-700">{person.authEmail}</span></p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA to Split */}
      <div className="pt-4 flex justify-end">
        <Link
          href="/split"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
        >
          Proceed to sharing
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default function RosterPage() {
  return <ProtectedPage allowedRoles={['boss']}><RosterContent /></ProtectedPage>;
}

