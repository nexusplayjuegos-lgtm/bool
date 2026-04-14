'use client';

import { useCallback, useEffect } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function usePresence(roomId: string): void {
  const updatePresence = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      await supabase
        .from('room_players')
        .update({ last_seen: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Presence heartbeat failed', error);
    }
  }, [roomId]);

  useEffect(() => {
    void updatePresence();

    const interval = window.setInterval(() => {
      void updatePresence();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [updatePresence]);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase
        .channel(`presence:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_players',
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            void updatePresence();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Presence subscription failed', error);
      return undefined;
    }
  }, [roomId, updatePresence]);
}
