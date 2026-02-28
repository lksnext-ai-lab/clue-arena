// src/tests/ws-protocol.test.ts
import { describe, it, expect } from 'vitest';
import { ServerMessageSchema, ClientMessageSchema } from '@/lib/ws/protocol';

describe('ServerMessageSchema', () => {
  it('parses a game:state message', () => {
    const msg = { type: 'game:state', gameId: 'g1', payload: { estado: 'en_curso' }, ts: 1000 };
    expect(() => ServerMessageSchema.parse(msg)).not.toThrow();
    expect(ServerMessageSchema.parse(msg).type).toBe('game:state');
  });

  it('parses a game:turn_completed message', () => {
    const msg = {
      type: 'game:turn_completed',
      gameId: 'g1',
      turnoNumero: 3,
      equipoId: 'eq1',
      resultadoTipo: 'sugerencia',
      ts: 1000,
    };
    expect(ServerMessageSchema.parse(msg).type).toBe('game:turn_completed');
  });

  it('parses a game:status_changed message', () => {
    const msg = {
      type: 'game:status_changed',
      gameId: 'g1',
      nuevoEstado: 'finalizada',
      ts: 1000,
    };
    expect(ServerMessageSchema.parse(msg).type).toBe('game:status_changed');
  });

  it('parses a ping message', () => {
    expect(ServerMessageSchema.parse({ type: 'ping', ts: 1000 }).type).toBe('ping');
  });

  it('parses a subscribed message', () => {
    expect(ServerMessageSchema.parse({ type: 'subscribed', gameId: 'g1' }).type).toBe('subscribed');
  });

  it('parses an error message', () => {
    const msg = { type: 'error', code: 'UNAUTHORIZED', message: 'Sin sesión válida' };
    expect(ServerMessageSchema.parse(msg).type).toBe('error');
  });

  it('rejects an unknown type', () => {
    expect(() => ServerMessageSchema.parse({ type: 'unknown' })).toThrow();
  });

  it('parses game:turn_completed with resultadoTipo pase', () => {
    const msg = {
      type: 'game:turn_completed',
      gameId: 'g1',
      turnoNumero: 2,
      equipoId: 'eq1',
      resultadoTipo: 'pase',
      ts: 1000,
    };
    expect(() => ServerMessageSchema.parse(msg)).not.toThrow();
    expect(ServerMessageSchema.parse(msg).type).toBe('game:turn_completed');
  });

  it('rejects game:turn_completed with invalid resultadoTipo', () => {
    const msg = {
      type: 'game:turn_completed',
      gameId: 'g1',
      turnoNumero: 1,
      equipoId: 'eq1',
      resultadoTipo: 'invalid',
      ts: 1000,
    };
    expect(() => ServerMessageSchema.parse(msg)).toThrow();
  });

  it('rejects game:status_changed with invalid nuevoEstado', () => {
    const msg = { type: 'game:status_changed', gameId: 'g1', nuevoEstado: 'eliminada', ts: 1000 };
    expect(() => ServerMessageSchema.parse(msg)).toThrow();
  });
});

describe('ClientMessageSchema', () => {
  it('parses a subscribe message', () => {
    const msg = { type: 'subscribe', gameId: 'g1' };
    expect(ClientMessageSchema.parse(msg).type).toBe('subscribe');
  });

  it('parses a pong message', () => {
    expect(ClientMessageSchema.parse({ type: 'pong' }).type).toBe('pong');
  });

  it('rejects missing gameId in subscribe', () => {
    expect(() => ClientMessageSchema.parse({ type: 'subscribe' })).toThrow();
  });

  it('rejects an unknown client message type', () => {
    expect(() => ClientMessageSchema.parse({ type: 'subscribe_all' })).toThrow();
  });
});
