'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getPublicEnv } from '@/lib/env/public';
import { Database } from '@/lib/supabase/database.types';
import { Tables } from '@/lib/supabase/database.types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const publicEnv = getPublicEnv();

  browserClient = createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey
  );

  return browserClient;
}

export type Room = Tables<'rooms'>;
export type RoomPlayer = Tables<'room_players'>;
export type Match = Tables<'matches'>;
