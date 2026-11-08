import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function redirectToLogin(requestUrl: URL, reason: string) {
  const loginUrl = new URL('/login', requestUrl.origin);
  loginUrl.searchParams.set('auth_error', reason);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/split';

  if (!code) return redirectToLogin(requestUrl, 'missing_code');

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) return redirectToLogin(requestUrl, 'exchange_failed');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const authorizationResponse = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: 'no-store',
    });

    const authorization = await authorizationResponse.json().catch(() => ({}));

    if (authorizationResponse.status === 403) {
      await supabase.auth.signOut();
      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('denied', '1');
      return NextResponse.redirect(loginUrl);
    }

    if (!authorizationResponse.ok) {
      await supabase.auth.signOut();
      return redirectToLogin(requestUrl, 'backend_unavailable');
    }

    return NextResponse.redirect(new URL(authorization.role === 'crew' ? '/hours' : destination, requestUrl.origin));
  } catch {
    return redirectToLogin(requestUrl, 'exchange_failed');
  }
}
