'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  accessError: string | null;
  refreshAccess: () => void;
  role: 'boss' | 'crew' | 'onboarding' | null;
  agencyId: string | null;
  agencyName: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  accessError: null,
  refreshAccess: () => undefined,
  role: null,
  agencyId: null,
  agencyName: null,
  signOut: async () => undefined,
});

const bossPaths = ['/split', '/roster', '/history'];
const crewPaths = ['/hours'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessCheckAttempt, setAccessCheckAttempt] = useState(0);
  const [role, setRole] = useState<'boss' | 'crew' | 'onboarding' | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setAgencyId(null);
      setAgencyName(null);
      setAccessError(null);
      return;
    }

    let active = true;
    setAccessError(null);
    setRole(null);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }).then(async response => {
      if (!active) return;
      const result = await response.json().catch(() => ({}));
      if (response.ok && ['boss', 'crew', 'onboarding'].includes(result.role)) {
        setRole(result.role);
        setAgencyId(typeof result.agency?.id === 'string' ? result.agency.id : null);
        setAgencyName(typeof result.agency?.name === 'string' ? result.agency.name : null);
        return;
      }
      setRole(null);
      setAgencyId(null);
      setAgencyName(null);
      if (response.status === 401 || response.status === 403) {
        await getSupabaseBrowserClient()?.auth.signOut();
        router.replace(`/login?${response.status === 403 ? 'denied=1' : 'auth_error=session_expired'}`);
        return;
      }
      setAccessError(result.error || 'BudPay could not verify your workspace right now. Try again.');
    }).catch(() => {
      if (active) {
        setRole(null);
        setAgencyId(null);
        setAgencyName(null);
        setAccessError('BudPay could not reach the workspace service. Check your connection and try again.');
      }
    });
    return () => { active = false; };
  }, [accessCheckAttempt, router, session]);

  useEffect(() => {
    const protectedRoute = [...bossPaths, ...crewPaths, '/agency/setup'].some(path => pathname === path || pathname.startsWith(`${path}/`));
    if (!loading && protectedRoute && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (role === 'crew' && bossPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      router.replace('/hours');
    }
    if (role === 'crew' && pathname === '/agency/setup') router.replace('/hours');
    if (role === 'boss' && pathname === '/agency/setup') router.replace('/marketplace');
    if (role === 'onboarding' && pathname !== '/agency/setup') router.replace('/agency/setup');
  }, [loading, pathname, role, router, session]);

  const refreshAccess = () => setAccessCheckAttempt(attempt => attempt + 1);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setAgencyId(null);
    setAgencyName(null);
    router.replace('/login');
  };

  return <AuthContext.Provider value={{ session, loading, accessError, refreshAccess, role, agencyId, agencyName, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedPage({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Array<'boss' | 'crew'> }) {
  const { session, loading, role, accessError, refreshAccess } = useAuth();

  if (accessError) return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center"><p className="text-sm text-rose-700" role="alert">{accessError}</p><button type="button" onClick={refreshAccess} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">Retry workspace check</button></div>;

  if (loading || !session || (role !== 'boss' && role !== 'crew') || !allowedRoles.includes(role)) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6 text-sm font-medium text-slate-500" role="status">
        Checking your BudPay access…
      </div>
    );
  }
  return children;
}
