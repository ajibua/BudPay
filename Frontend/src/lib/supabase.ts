import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}

export function getAuthCallbackUrl() {
  return new URL('/auth/callback', window.location.origin).toString();
}

export function getPasswordResetUrl() {
  return new URL('/auth/recovery', window.location.origin).toString();
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const client = getSupabaseBrowserClient();
  const { data } = client ? await client.auth.getSession() : { data: { session: null } };
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
