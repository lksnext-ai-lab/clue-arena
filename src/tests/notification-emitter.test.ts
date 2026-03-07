// src/tests/notification-emitter.test.ts
// Unit tests for the NotificationEmitter singleton (F018)
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';
import type { GlobalNotificationEvent, TeamNotificationEvent } from '@/lib/ws/NotificationEmitter';

describe('NotificationEmitter', () => {
  it('is an EventEmitter instance', () => {
    expect(notificationEmitter).toBeInstanceOf(EventEmitter);
  });

  it('has maxListeners set to 300', () => {
    expect(notificationEmitter.getMaxListeners()).toBe(300);
  });

  // ── Global events ────────────────────────────────────────────────────────

  it('emits notification:game_scheduled and listener receives it', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onGlobal(listener);

    const event: GlobalNotificationEvent = {
      type: 'notification:game_scheduled',
      gameId: 'game-1',
      nombre: 'Partida Test',
      ts: 1000,
    };

    notificationEmitter.emitGlobal(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('emits notification:game_started and listener receives it', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onGlobal(listener);

    const event: GlobalNotificationEvent = { type: 'notification:game_started', gameId: 'g1', nombre: 'Partida 1', ts: 2000 };
    notificationEmitter.emitGlobal(event);

    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it('emits notification:game_finished with winner info', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onGlobal(listener);

    const event: GlobalNotificationEvent = {
      type: 'notification:game_finished',
      gameId: 'g1',
      nombre: 'Partida 1',
      ganadorId: 'team-abc',
      ganadorNombre: 'Equipo A',
      ts: 3000,
    };
    notificationEmitter.emitGlobal(event);

    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it('emits notification:ranking_updated', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onGlobal(listener);

    const event: GlobalNotificationEvent = { type: 'notification:ranking_updated', ts: 4000 };
    notificationEmitter.emitGlobal(event);

    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it('onGlobal unsubscribe removes the listener', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onGlobal(listener);
    unsubscribe();

    notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple global listeners all receive events', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const unsub1 = notificationEmitter.onGlobal(l1);
    const unsub2 = notificationEmitter.onGlobal(l2);

    notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: 0 });

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();

    unsub1();
    unsub2();
  });

  // ── Team events ──────────────────────────────────────────────────────────

  it('emits notification:training_started and team listener receives it', () => {
    const listener = vi.fn();
    const equipoId = 'equipo-team-1';
    const unsubscribe = notificationEmitter.onTeam(equipoId, listener);

    const event: TeamNotificationEvent = {
      type: 'notification:training_started',
      trainingGameId: 'training-1',
      equipoId,
      numBots: 2,
      ts: 5000,
    };
    notificationEmitter.emitTeam(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('emits notification:training_finished and team listener receives it', () => {
    const listener = vi.fn();
    const equipoId = 'equipo-team-2';
    const unsubscribe = notificationEmitter.onTeam(equipoId, listener);

    const event: TeamNotificationEvent = {
      type: 'notification:training_finished',
      trainingGameId: 'training-2',
      equipoId,
      estado: 'finalizada',
      ganadorId: equipoId,
      numTurnos: 12,
      puntosSimulados: 1200,
      ts: 6000,
    };
    notificationEmitter.emitTeam(event);

    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it('emits notification:training_error and team listener receives it', () => {
    const listener = vi.fn();
    const equipoId = 'equipo-team-3';
    const unsubscribe = notificationEmitter.onTeam(equipoId, listener);

    const event: TeamNotificationEvent = {
      type: 'notification:training_error',
      trainingGameId: 'training-3',
      equipoId,
      message: 'Agent unavailable',
      ts: 7000,
    };
    notificationEmitter.emitTeam(event);

    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it('team event does NOT reach a listener for a different equipoId', () => {
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onTeam('equipo-A', listener);

    notificationEmitter.emitTeam({
      type: 'notification:training_started',
      trainingGameId: 't1',
      equipoId: 'equipo-B',
      numBots: 1,
      ts: 0,
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('onTeam unsubscribe removes the listener', () => {
    const equipoId = 'equipo-unsub-test';
    const listener = vi.fn();
    const unsubscribe = notificationEmitter.onTeam(equipoId, listener);
    unsubscribe();

    notificationEmitter.emitTeam({
      type: 'notification:training_error',
      trainingGameId: 't1',
      equipoId,
      message: 'err',
      ts: 0,
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('team and global listeners are independent channels', () => {
    const globalListener = vi.fn();
    const teamListener = vi.fn();
    const equipoId = 'equipo-isolation';

    const unsub1 = notificationEmitter.onGlobal(globalListener);
    const unsub2 = notificationEmitter.onTeam(equipoId, teamListener);

    // Emit only a team event
    notificationEmitter.emitTeam({
      type: 'notification:training_started',
      trainingGameId: 't1',
      equipoId,
      numBots: 0,
      ts: 0,
    });

    expect(globalListener).not.toHaveBeenCalled();  // global listener must NOT fire
    expect(teamListener).toHaveBeenCalledOnce();    // team listener must fire

    // Now emit only a global event
    globalListener.mockReset();
    teamListener.mockReset();

    notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: 0 });

    expect(globalListener).toHaveBeenCalledOnce(); // global listener must fire
    expect(teamListener).not.toHaveBeenCalled();   // team listener must NOT fire

    unsub1();
    unsub2();
  });
});
