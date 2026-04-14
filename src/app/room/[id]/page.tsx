'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLobby } from '@/hooks/useLobby';
import { usePresence } from '@/hooks/usePresence';
import { Room, RoomPlayer, createSupabaseBrowserClient } from '@/lib/supabase/client';

function isPlayerOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 20_000;
}

export default function RoomPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const roomId = typeof params.id === 'string' ? params.id : '';
  const { leaveRoom } = useLobby();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  usePresence(roomId);

  const readyPlayers = useMemo(() => players.filter(player => player.is_ready).length, [players]);

  const fetchRoom = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();

    if (error) {
      throw error;
    }

    setRoom(data);
  }, [roomId]);

  const fetchPlayers = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('player_number', { ascending: true });

    if (error) {
      throw error;
    }

    const nextPlayers = data ?? [];
    setPlayers(nextPlayers);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsReady(Boolean(nextPlayers.find(player => player.user_id === user?.id)?.is_ready));

    if (nextPlayers.length === 2 && nextPlayers.every(player => player.is_ready)) {
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', roomId);

      if (!roomError) {
        router.push(`/game?room=${roomId}`);
      }
    }
  }, [roomId, router]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const bootstrap = async (): Promise<void> => {
      try {
        await Promise.all([fetchRoom(), fetchPlayers()]);
      } catch (error) {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : 'Unable to load room');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => {
          void fetchRoom();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        () => {
          void fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [fetchPlayers, fetchRoom, roomId]);

  const toggleReady = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setActionError('Not authenticated');
      return;
    }

    setActionError(null);

    const { error } = await supabase
      .from('room_players')
      .update({ is_ready: !isReady, last_seen: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (error) {
      setActionError(error.message);
      return;
    }

    setIsReady(previous => !previous);
    await fetchPlayers();
  }, [fetchPlayers, isReady, roomId]);

  const handleLeave = useCallback(async () => {
    try {
      await leaveRoom(roomId);
      router.push('/lobby');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to leave room');
    }
  }, [leaveRoom, roomId, router]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 p-8 text-white">Loading room...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <p>Room not found.</p>
        <Link href="/lobby" className="mt-4 inline-flex text-emerald-300">
          Back to lobby
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#020617,#07111d_38%,#0f172a)] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300/75">Room Waiting Area</p>
              <h1 className="mt-3 text-4xl font-semibold">{room.name}</h1>
              <p className="mt-2 text-slate-300">
                {players.length}/2 players connected • {readyPlayers}/2 ready
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleLeave()}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              Leave room
            </button>
          </div>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Players</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {players.map(player => (
              <article
                key={player.id}
                className="rounded-[28px] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Player {player.player_number}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Last heartbeat: {new Date(player.last_seen).toLocaleTimeString()}
                    </p>
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isPlayerOnline(player.last_seen) ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <p className={`mt-4 text-sm ${player.is_ready ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {player.is_ready ? 'Ready' : 'Waiting'}
                </p>
              </article>
            ))}

            {players.length < 2 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-black/10 p-5 text-slate-500">
                Waiting for another player to join...
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => void toggleReady()}
              className={`rounded-full px-6 py-3 text-sm font-medium transition ${
                isReady
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {isReady ? 'Cancel ready' : 'Ready up'}
            </button>

            {players.length === 2 && readyPlayers === 2 ? (
              <p className="text-sm text-emerald-300">All players ready. Starting match...</p>
            ) : (
              <p className="text-sm text-slate-400">Match starts automatically when both players are ready.</p>
            )}
          </div>

          {actionError ? <p className="mt-4 text-sm text-rose-300">{actionError}</p> : null}
        </section>
      </div>
    </main>
  );
}
