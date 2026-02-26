/**
 * Unit tests for the auto-run loop (F007 §14.3).
 *
 * `advanceTurn` (coordinator) is mocked so tests run without a real
 * game engine or LLM. DB operations (reads/writes on `partidas`) use a real
 * in-memory SQLite database so we can assert on field values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb } from './db';
import type { TestDb } from './db';

// ── DB injection ─────────────────────────────────────────────────────────────
const testDbContainer: { db: ReturnType<typeof createTestDb>['db'] | null } = { db: null };
vi.mock('@/lib/db', () => ({
  get db() {
    return testDbContainer.db;
  },
}));

// ── Mock advanceTurn — by default returns { gameOver: false, ... } ────────────
const mockAdvanceTurn = vi.fn();
vi.mock('@/lib/game/coordinator', () => ({
  advanceTurn: (...args: unknown[]) => mockAdvanceTurn(...args),
  CoordinatorError: class CoordinatorError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { startAutoRun } from '@/lib/game/auto-run';
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function insertGame(
  db: ReturnType<typeof createTestDb>['db'],
  overrides: Partial<{
    estado: 'pendiente' | 'en_curso' | 'finalizada';
    modoEjecucion: 'manual' | 'auto' | 'pausado';
    autoRunActivoDesde: Date | null;
  }> = {},
) {
  const id = uuidv4();
  await db.insert(partidas).values({
    id,
    nombre: 'Test',
    estado: overrides.estado ?? 'en_curso',
    turnoActual: 0,
    modoEjecucion: overrides.modoEjecucion ?? 'auto',
    turnoDelayMs: 0,
    autoRunActivoDesde: overrides.autoRunActivoDesde ?? new Date(),
    createdAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
  });
  return id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('startAutoRun', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    mockAdvanceTurn.mockReset();
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('runs until game is finalizada', async () => {
    const gameId = await insertGame(testDb.db);

    // First two calls: game still running. Third: marks finalizada.
    mockAdvanceTurn
      .mockResolvedValueOnce({ gameOver: false, reason: 'suggestion_applied', teamId: 'team-a', actionType: 'suggestion' })
      .mockResolvedValueOnce({ gameOver: false, reason: 'suggestion_applied', teamId: 'team-b', actionType: 'suggestion' })
      .mockImplementationOnce(async () => {
        // Simulate the coordinator marking the game as finished
        await testDb.db
          .update(partidas)
          .set({ estado: 'finalizada', finishedAt: new Date() })
          .where(eq(partidas.id, gameId));
        return { gameOver: true, reason: 'accusation_correct', teamId: 'team-a', actionType: 'accusation' };
      });

    await startAutoRun(gameId, 0);

    expect(mockAdvanceTurn).toHaveBeenCalledTimes(3);

    const [p] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(p.estado).toBe('finalizada');
    // Loop must clear the sentinel
    expect(p.autoRunActivoDesde).toBeNull();
  });

  it('stops when modoEjecucion is changed to pausado', async () => {
    const gameId = await insertGame(testDb.db);

    // The mock updates the DB to 'pausado' after the first call, so the loop
    // checks modoEjecucion at the start of the second iteration and stops.
    let callCount = 0;
    mockAdvanceTurn.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Simulate an external pause arriving during the turn
        await testDb.db
          .update(partidas)
          .set({ modoEjecucion: 'pausado' })
          .where(eq(partidas.id, gameId));
        return { gameOver: false, reason: 'suggestion_applied', teamId: 'team-a', actionType: 'suggestion' };
      }
      // Should never be called again
      return { gameOver: false, reason: 'suggestion_applied', teamId: 'team-b', actionType: 'suggestion' };
    });

    await startAutoRun(gameId, 0);

    // Only one turn executed — pause detected before the second iteration
    expect(mockAdvanceTurn).toHaveBeenCalledTimes(1);

    const [p] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    // autoRunActivoDesde cleared even after pause
    expect(p.autoRunActivoDesde).toBeNull();
  });

  it('clears autoRunActivoDesde when loop exits normally', async () => {
    const gameId = await insertGame(testDb.db, { autoRunActivoDesde: new Date() });

    mockAdvanceTurn.mockImplementationOnce(async () => {
      await testDb.db
        .update(partidas)
        .set({ estado: 'finalizada' })
        .where(eq(partidas.id, gameId));
      return { gameOver: true, reason: 'accusation_correct', teamId: 'team-a', actionType: 'accusation' };
    });

    await startAutoRun(gameId, 0);

    const [p] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(p.autoRunActivoDesde).toBeNull();
  });

  it('clears autoRunActivoDesde even when advanceTurn throws', async () => {
    const gameId = await insertGame(testDb.db);

    mockAdvanceTurn.mockRejectedValue(new Error('Unexpected engine error'));

    await startAutoRun(gameId, 0); // Should not throw

    const [p] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(p.autoRunActivoDesde).toBeNull();
  });

  it('does not start when game is already finalizada', async () => {
    const gameId = await insertGame(testDb.db, {
      estado: 'finalizada',
      modoEjecucion: 'auto',
    });

    await startAutoRun(gameId, 0);

    expect(mockAdvanceTurn).not.toHaveBeenCalled();
  });

  it('executes with turnoDelayMs = 0 (no sleep)', async () => {
    const gameId = await insertGame(testDb.db);
    let turns = 0;

    mockAdvanceTurn.mockImplementation(async () => {
      turns++;
      if (turns >= 3) {
        await testDb.db
          .update(partidas)
          .set({ estado: 'finalizada' })
          .where(eq(partidas.id, gameId));
        return { gameOver: true, reason: 'accusation_correct', teamId: 'team-a', actionType: 'accusation' };
      }
      return { gameOver: false, reason: 'suggestion_applied', teamId: 'team-a', actionType: 'suggestion' };
    });

    const start = Date.now();
    await startAutoRun(gameId, 0);
    const elapsed = Date.now() - start;

    expect(mockAdvanceTurn).toHaveBeenCalledTimes(3);
    // With 0ms delay, should complete very quickly (< 200ms in practice)
    expect(elapsed).toBeLessThan(2000);
  });
});
