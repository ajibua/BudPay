'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  role: 'boss' | 'crew' | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  role: null,
  signOut: async () => undefined,
});

const bossPaths = ['/split', '/roster', '/history'];
const crewPaths = ['/hours'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'boss' | 'crew' | null>(null);
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
      return;
    }

    let active = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }).then(async response => {
      if (!active) return;
      const result = await response.json().catch(() => ({}));
      if (response.ok && (result.role === 'boss' || result.role === 'crew')) {
        setRole(result.role);
        return;
      }
      setRole(null);
      await getSupabaseBrowserClient()?.auth.signOut();
      router.replace(`/login?${response.status === 403 ? 'denied=1' : 'auth_error=backend_unavailable'}`);
    }).catch(() => {
      if (active) {
        setRole(null);
        router.replace('/login?auth_error=backend_unavailable');
      }
    });
    return () => { active = false; };
  }, [router, session]);

  useEffect(() => {
    const protectedRoute = [...bossPaths, ...crewPaths].some(path => pathname === path || pathname.startsWith(`${path}/`));
    if (!loading && protectedRoute && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (role === 'crew' && bossPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      router.replace('/hours');
    }
  }, [loading, pathname, role, router, session]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    router.replace('/login');
  };

  return <AuthContext.Provider value={{ session, loading, role, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedPage({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Array<'boss' | 'crew'> }) {
  const { session, loading, role } = useAuth();

  if (loading || !session || !role || !allowedRoles.includes(role)) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6 text-sm font-medium text-slate-500" role="status">
        Checking your BudPay access…
      </div>
    );
  }
  return children;
}
