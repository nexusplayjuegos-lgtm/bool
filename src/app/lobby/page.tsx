'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { useLobby } from '@/hooks/useLobby';

export default function LobbyPage(): JSX.Element {
  const router = useRouter();
  const { rooms, loading, error, createRoom, joinRoom } = useLobby();
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const waitingRooms = useMemo(() => rooms.filter(room => room.status === 'waiting'), [rooms]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!newRoomName.trim()) {
      return;
    }

    setActionError(null);
    setCreating(true);

    try {
      const room = await createRoom(newRoomName.trim());
      setNewRoomName('');
      router.push(`/room/${room.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create room');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(roomId: string): Promise<void> {
    setActionError(null);

    try {
      await joinRoom(roomId);
      router.push(`/room/${roomId}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to join room');
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#020617,#07111d_38%,#0f172a)] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur md:p-12">
          <p className="text-xs uppercase tracking-[0.38em] text-emerald-300/75">Lobby Realtime</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Create a room, join a rival and get ready for the match.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            Rooms and player presence are now driven by Supabase Realtime, so the lobby stays fresh for every player.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">New Room</p>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300" htmlFor="room-name">
                Room name
              </label>
              <input
                id="room-name"
                type="text"
                value={newRoomName}
                onChange={event => setNewRoomName(event.target.value)}
                placeholder="Friday Night Table"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creating room...' : 'Create room'}
              </button>
            </form>

            {actionError ? <p className="mt-4 text-sm text-rose-300">{actionError}</p> : null}
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Open Rooms</p>
                <h2 className="mt-2 text-2xl font-semibold">Waiting for challengers</h2>
              </div>
              <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                {waitingRooms.length} active
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-slate-400">
                  Loading rooms...
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
                  {error}
                </div>
              ) : waitingRooms.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-slate-500">
                  No open rooms right now.
                </div>
              ) : (
                waitingRooms.map(room => (
                  <article
                    key={room.id}
                    className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/20 p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <h3 className="text-xl font-semibold">{room.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {room.current_players}/2 players • {room.game_mode} • status {room.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleJoin(room.id)}
                      disabled={room.current_players >= 2}
                      className="rounded-full bg-sky-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {room.current_players >= 2 ? 'Full' : 'Join room'}
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
