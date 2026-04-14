'use client';

import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

import { GameMode, Vector2 } from '@/engine/types';
import { createGame, MultiplayerGameEvent } from '@/hooks/useGame';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ShotPayload {
  angle: number;
  power: number;
  spin: Vector2;
  from: 1 | 2;
}

function isShotPayload(value: unknown): value is ShotPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.angle === 'number' &&
    typeof payload.power === 'number' &&
    typeof payload.from === 'number' &&
    typeof payload.spin === 'object' &&
    payload.spin !== null &&
    typeof (payload.spin as Record<string, unknown>).x === 'number' &&
    typeof (payload.spin as Record<string, unknown>).y === 'number'
  );
}

function isMultiplayerGameEvent(value: unknown): value is MultiplayerGameEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Record<string, unknown>;

  if (event.type === 'SHOT_FIRED') {
    return (
      typeof event.angle === 'number' &&
      typeof event.power === 'number' &&
      typeof event.spin === 'object' &&
      event.spin !== null
    );
  }

  if (event.type === 'BALL_POCKETED') {
    return typeof event.ballId === 'string' && typeof event.pocketId === 'string';
  }

  if (event.type === 'TURN_END') {
    return event.nextPlayer === 1 || event.nextPlayer === 2;
  }

  if (event.type === 'GAME_OVER') {
    const finalScore = event.finalScore as Record<string, unknown> | undefined;
    return (
      (event.winner === 1 || event.winner === 2) &&
      Boolean(finalScore) &&
      typeof finalScore?.p1 === 'number' &&
      typeof finalScore?.p2 === 'number'
    );
  }

  if (event.type === 'GROUP_ASSIGNED') {
    return (
      (event.player === 1 || event.player === 2) &&
      (event.group === 'solid' || event.group === 'stripe')
    );
  }

  return false;
}

export function useMultiplayer(roomId: string, playerNumber: 1 | 2, mode: GameMode = 'snooker') {
  const gameRef = useRef<ReturnType<typeof createGame> | null>(null);

  // Initialize game store with mode (only once)
  if (!gameRef.current) {
    gameRef.current = createGame(mode);
  }

  const game = gameRef.current();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isHost = playerNumber === 1;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`game:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'shot_fired' }, ({ payload }) => {
        if (!isShotPayload(payload) || payload.from === playerNumber) {
          return;
        }

        game.applyOpponentShot(payload.angle, payload.power, payload.spin);
      })
      .on('broadcast', { event: 'game_event' }, ({ payload }) => {
        if (!isMultiplayerGameEvent(payload)) {
          return;
        }

        game.applyRemoteEvent(payload);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [game, playerNumber, roomId]);

  useEffect(() => {
    if (!isHost) {
      return;
    }

    const unsubscribe = game.onGameEvent(event => {
      if (event.type === 'SHOT_FIRED') {
        return;
      }

      void channelRef.current?.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event,
      });
    });

    return unsubscribe;
  }, [game, isHost]);

  const broadcastShot = (angle: number, power: number, spin: Vector2): void => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'shot_fired',
      payload: { angle, power, spin, from: playerNumber },
    });
  };

  return {
    ...game,
    broadcastShot,
    isMyTurn: game.currentPlayer === playerNumber,
    isHost,
  };
}
