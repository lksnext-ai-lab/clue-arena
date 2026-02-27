// src/tests/GameEventEmitter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Import the singleton (fresh each test via module re-import trick)
// Since the singleton is module-level, we test behavior via its API.
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';
import type { GameStateEvent } from '@/lib/ws/protocol';

describe('GameEventEmitter', () => {
  it('is an EventEmitter instance', () => {
    expect(gameEventEmitter).toBeInstanceOf(EventEmitter);
  });

  it('has maxListeners set to 200', () => {
    expect(gameEventEmitter.getMaxListeners()).toBe(200);
  });

  it('emits turn_completed event and listener receives it', () => {
    const gameId = 'test-game-1';
    const listener = vi.fn();
    const unsubscribe = gameEventEmitter.onGameUpdate(gameId, listener);

    const event: GameStateEvent = {
      type: 'turn_completed',
      gameId,
      payload: { turnoNumero: 1, equipoId: 'eq1', resultadoTipo: 'sugerencia' },
    };

    gameEventEmitter.emitTurnCompleted(gameId, event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('emits status_changed event and listener receives it', () => {
    const gameId = 'test-game-2';
    const listener = vi.fn();
    const unsubscribe = gameEventEmitter.onGameUpdate(gameId, listener);

    const event: GameStateEvent = {
      type: 'status_changed',
      gameId,
      payload: { nuevoEstado: 'finalizada' },
    };

    gameEventEmitter.emitTurnCompleted(gameId, event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('does not call listener for a different gameId', () => {
    const listener = vi.fn();
    const unsubscribe = gameEventEmitter.onGameUpdate('game-A', listener);

    gameEventEmitter.emitTurnCompleted('game-B', {
      type: 'turn_completed',
      gameId: 'game-B',
      payload: {},
    });

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('unsubscribe removes the listener', () => {
    const gameId = 'test-game-3';
    const listener = vi.fn();
    const unsubscribe = gameEventEmitter.onGameUpdate(gameId, listener);

    unsubscribe();

    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'turn_completed',
      gameId,
      payload: {},
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple listeners for same gameId all receive events', () => {
    const gameId = 'test-game-4';
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const unsub1 = gameEventEmitter.onGameUpdate(gameId, listener1);
    const unsub2 = gameEventEmitter.onGameUpdate(gameId, listener2);

    const event: GameStateEvent = { type: 'turn_completed', gameId, payload: {} };
    gameEventEmitter.emitTurnCompleted(gameId, event);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();

    unsub1();
    unsub2();
  });
});
