'use client';

import { useCallback, useEffect, useState } from 'react';

import { Room, RoomPlayer, createSupabaseBrowserClient } from '@/lib/supabase/client';

interface UseLobbyResult {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  createRoom: (name: string) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function mapRoomPlayerCount(players: RoomPlayer[]): Map<string, number> {
  return players.reduce((accumulator, player) => {
    const previous = accumulator.get(player.room_id) ?? 0;
    accumulator.set(player.room_id, previous + 1);
    return accumulator;
  }, new Map<string, number>());
}

export function useLobby(): UseLobbyResult {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);

    try {
      const [roomsResult, playersResult] = await Promise.all([
        supabase.from('rooms').select('*').eq('status', 'waiting').order('created_at', { ascending: false }),
        supabase.from('room_players').select('*'),
      ]);

      if (roomsResult.error) {
        throw roomsResult.error;
      }

      if (playersResult.error) {
        throw playersResult.error;
      }

      const playerCounts = mapRoomPlayerCount(playersResult.data ?? []);
      const nextRooms = (roomsResult.data ?? []).map(room => ({
        ...room,
        current_players: playerCounts.get(room.id) ?? room.current_players,
      }));

      setRooms(nextRooms);
    } catch (fetchError) {
      console.error('Failed to fetch rooms', fetchError);
      setRooms([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        void fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => {
        void fetchRooms();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  const createRoom = useCallback(async (name: string) => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        name,
        created_by: user.id,
        current_players: 1,
      })
      .select()
      .single();

    if (error || !room) {
      throw error ?? new Error('Room not created');
    }

    const { error: playerError } = await supabase.from('room_players').insert({
      room_id: room.id,
      user_id: user.id,
      player_number: 1,
    });

    if (playerError) {
      throw playerError;
    }

    await fetchRooms();
    return room;
  }, [fetchRooms]);

  const joinRoom = useCallback(async (roomId: string) => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: existingPlayers, error: playersError } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('player_number', { ascending: true });

    if (playersError) {
      throw playersError;
    }

    const players = existingPlayers ?? [];
    const alreadyInRoom = players.some(player => player.user_id === user.id);
    if (alreadyInRoom) {
      return;
    }

    if (players.length >= 2) {
      throw new Error('Room full');
    }

    const playerNumber = players.some(player => player.player_number === 1) ? 2 : 1;

    const { error: insertError } = await supabase.from('room_players').insert({
      room_id: roomId,
      user_id: user.id,
      player_number: playerNumber,
    });

    if (insertError) {
      throw insertError;
    }

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ current_players: players.length + 1 })
      .eq('id', roomId);

    if (roomError) {
      throw roomError;
    }

    await fetchRooms();
  }, [fetchRooms]);

  const leaveRoom = useCallback(async (roomId: string) => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: playersBeforeDelete, error: beforeDeleteError } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId);

    if (beforeDeleteError) {
      throw beforeDeleteError;
    }

    const { error: deleteError } = await supabase
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    const nextCount = Math.max(0, (playersBeforeDelete?.length ?? 1) - 1);
    const nextStatus = nextCount === 0 ? 'finished' : 'waiting';

    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({
        current_players: nextCount,
        status: nextStatus,
      })
      .eq('id', roomId);

    if (roomUpdateError) {
      throw roomUpdateError;
    }

    await fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    refresh: fetchRooms,
  };
}
