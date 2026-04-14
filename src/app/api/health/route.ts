import { NextResponse } from 'next/server';

import { getServerEnv, hasServerSupabaseEnv } from '@/lib/env/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({
      ok: true,
      project: 'sinuca-premiere',
      phase: 1,
      physics: 'matter-js',
      render: 'canvas-2.5d',
      supabase: {
        configured: false,
        url: null,
        hasServiceRole: false,
        hasSession: false,
        authError: 'Supabase environment variables are not set',
      },
    });
  }

  const serverEnv = getServerEnv();
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  return NextResponse.json({
    ok: true,
    project: 'sinuca-premiere',
    phase: 1,
    physics: 'matter-js',
    render: 'canvas-2.5d',
    supabase: {
      configured: true,
      url: serverEnv.supabaseUrl,
      hasServiceRole: Boolean(serverEnv.supabaseServiceRoleKey),
      hasSession: Boolean(session),
      authError: error?.message ?? null,
    },
  });
}
