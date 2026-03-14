/**
 * Unit tests for the get_game_state MCP tool — training game fallback (T1).
 *
 * Verifies that when a game_id is not found in `partidas` (tournament table),
 * the tool correctly falls back to `partidas_entrenamiento` and returns a valid
 * GameStateView for the requesting team.
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

// ── Import after mocks ────────────────────────────────────────────────────────
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { usuarios, equipos, partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';

describe('getGameStateTool — training game fallback', () => {
  let testDb: TestDb;

  // Seed data constants
  const userId = uuidv4();
  const equipoId = uuidv4();
  const gameId = uuidv4();

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
  });

  afterEach(() => {
    testDbContainer.db = null;
    testDb.close();
  });

  async function seedTrainingGame(extraEquipoIds: string[] = []) {
    // Insert a minimal user + equipo
    await testDb.db.insert(usuarios).values({
      id: userId,
      email: 'test@example.com',
      nombre: 'Test User',
      rol: 'equipo',
      createdAt: new Date(),
    });
    await testDb.db.insert(equipos).values({
      id: equipoId,
      nombre: 'Team Alpha',
      agentId: 'agent-001',
      agentBackend: 'local',
      usuarioId: userId,
      miembros: '[]',
      createdAt: new Date(),
    });

    // Insert training game — NOT in partidas (tournament table)
    const allTeamIds = [equipoId, ...extraEquipoIds];
    const seedStr = 'test-seed-42';
    await testDb.db.insert(partidasEntrenamiento).values({
      id: gameId,
      equipoId,
      estado: 'en_curso',
      numBots: extraEquipoIds.length,
      maxTurnos: 50,
      seed: seedStr,
      createdAt: new Date(),
    });

    return { allTeamIds, seedStr };
  }

  it('throws when game_id is not in partidas AND not in partidas_entrenamiento', async () => {
    await seedTrainingGame();
    const unknownId = uuidv4();
    await expect(
      getGameStateTool.handler({ game_id: unknownId, team_id: equipoId }),
    ).rejects.toThrow(unknownId);
  });

  it('returns a valid GameStateView for the real team on a fresh training game (no turns yet)', async () => {
    await seedTrainingGame(['bot-1', 'bot-2']);

    const result = await getGameStateTool.handler({ game_id: gameId, team_id: equipoId });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const view = JSON.parse(result.content[0].text) as {
      gameId: string;
      equipos: { equipoId: string; esPropio: boolean; cartas: unknown[] }[];
    };
    expect(view).toHaveProperty('gameId', gameId);
    const ownEntry = view.equipos.find((e) => e.esPropio);
    expect(ownEntry?.equipoId).toBe(equipoId);
    expect(Array.isArray(ownEntry?.cartas)).toBe(true);
  });

  it('returns the persisted gameStateView when at least one turn exists for the team', async () => {
    await seedTrainingGame(['bot-1']);

    // Persist a turn with a saved gameStateView
    const fakeView = JSON.stringify({ gameId, teamId: equipoId, myCards: ['Scarlett'], historial: [] });
    await testDb.db.insert(turnosEntrenamiento).values({
      id: uuidv4(),
      partidaId: gameId,
      equipoId,
      esBot: false,
      numero: 1,
      accion: JSON.stringify({ action: { type: 'pass' }, reasoning: '', done: true }),
      gameStateView: fakeView,
      createdAt: new Date(),
    });

    const result = await getGameStateTool.handler({ game_id: gameId, team_id: equipoId });

    // Should return the persisted view directly (most efficient path)
    const view = JSON.parse(result.content[0].text) as { myCards: string[] };
    expect(view.myCards).toContain('Scarlett');
  });

  it('throws when the requesting team is not part of the training game', async () => {
    await seedTrainingGame(['bot-1']);
    const outsiderId = uuidv4();

    // No turn exists for outsider; the fallback replay also cannot find the team
    await expect(
      getGameStateTool.handler({ game_id: gameId, team_id: outsiderId }),
    ).rejects.toThrow();
  });
});
