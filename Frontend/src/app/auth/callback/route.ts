import { handleSupabaseAuthCallback } from '@/lib/auth-callback';

export async function GET(request: Request) {
  return handleSupabaseAuthCallback(request);
}
