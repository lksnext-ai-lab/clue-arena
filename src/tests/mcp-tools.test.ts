/**
 * Integration tests — MCP tools and coordinator (F007 §14.2).
 *
 * Tests the full advance-turn cycle (suggestion / accusation / refutation)
 * using an in-memory SQLite database.  The LLM / agent backend is mocked via
 * `vi.mock('@/lib/api/agent')`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb } from './db';
import type { TestDb } from './db';

// ── DB injection (must come before imports that use @/lib/db) ────────────────
const testDbContainer: { db: ReturnType<typeof createTestDb>['db'] | null } = { db: null };
vi.mock('@/lib/db', () => ({
  get db() {
    return testDbContainer.db;
  },
}));

// ── Agent mock (no real LLM) ─────────────────────────────────────────────────
const mockInvokeAgent = vi.fn();
vi.mock('@/lib/api/agent', () => ({
  invokeAgent: (...args: unknown[]) => mockInvokeAgent(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { advanceTurn, CoordinatorError } from '@/lib/game/coordinator';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { showCardTool } from '@/lib/mcp/tools/show-card';

// ── Schema imports for test data setup ───────────────────────────────────────
import {
  usuarios,
  equipos,
  partidas,
  partidaEquipos,
  sobres,
  turnos,
  sugerencias,
  acusaciones,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ── Constants ────────────────────────────────────────────────────────────────
const SOSPECHOSO = 'Coronel Mostaza';
const ARMA = 'Cuchillo';
const HABITACION = 'Cocina';
const SOSPECHOSO_INCORRECTO = 'Señorita Escarlata';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupGame(
  db: ReturnType<typeof createTestDb>['db'],
  opts: {
    teams?: string[];
    envelop?: { sospechoso: string; arma: string; habitacion: string };
    teamCards?: Record<string, string[]>;
  } = {},
) {
  const gameId = uuidv4();
  const teams = opts.teams ?? ['team-a', 'team-b', 'team-c'];
  const envelop = opts.envelop ?? { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION };

  // Create a base usuario for all teams (FK requirement)
  const userId = uuidv4();
  await db.insert(usuarios).values({
    id: userId,
    email: 'test@test.com',
    nombre: 'Test User',
    rol: 'equipo',
    createdAt: new Date(),
  });

  // Create equipo rows (required by partidaEquipos FK)
  for (const teamId of teams) {
    await db.insert(equipos).values({
      id: teamId,
      nombre: `Equipo ${teamId}`,
      agentId: `agent-${teamId}`,
      usuarioId: userId,
      estado: 'activo',
      createdAt: new Date(),
    });
  }

  // Create partida
  await db.insert(partidas).values({
    id: gameId,
    nombre: 'Test Game',
    estado: 'en_curso',
    turnoActual: 0,
    modoEjecucion: 'manual',
    turnoDelayMs: 0,
    autoRunActivoDesde: null,
    createdAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
  });

  // Create envelope
  await db.insert(sobres).values({
    id: uuidv4(),
    partidaId: gameId,
    sospechoso: envelop.sospechoso,
    arma: envelop.arma,
    habitacion: envelop.habitacion,
  });

  // Create team-partida associations
  const defaultCards: Record<string, string[]> = {
    'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
    'team-b': ['Reverendo Verde', 'Cuerda', 'Comedor'],
    'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
  };
  const cardMap = opts.teamCards ?? defaultCards;

  for (let i = 0; i < teams.length; i++) {
    await db.insert(partidaEquipos).values({
      id: uuidv4(),
      partidaId: gameId,
      equipoId: teams[i],
      orden: i,
      eliminado: false,
      puntos: 0,
      cartas: JSON.stringify(cardMap[teams[i]] ?? []),
    });
  }

  // Create first turn
  const turnoId = uuidv4();
  await db.insert(turnos).values({
    id: turnoId,
    partidaId: gameId,
    equipoId: teams[0],
    numero: 1,
    estado: 'en_curso',
    startedAt: new Date(),
    finishedAt: null,
  });

  return { gameId, turnoId };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Coordinator — advanceTurn', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    mockInvokeAgent.mockReset();
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Suggestion flow
  // ──────────────────────────────────────────────────────────────────────────

  it('applies suggestion — no refutador when no team has the cards', async () => {
    const { gameId } = await setupGame(testDb.db, {
      // Ensure no team has the exact suggestion cards
      teamCards: {
        'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
        'team-b': ['Reverendo Verde', 'Cuerda', 'Comedor'],
        'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
      },
    });

    // Suggestion with cards nobody holds
    mockInvokeAgent.mockResolvedValue({
      action: { type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
      reasoning: 'test',
      done: true,
    });

    const result = await advanceTurn(gameId);

    expect(result.actionType).toBe('suggestion');
    expect(result.gameOver).toBe(false);

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.refutadaPor).toBeNull();
    expect(sg.cartaMostrada).toBeNull();
  });

  it('applies suggestion — finds refutador and invokes refute agent', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
        'team-b': ['Coronel Mostaza', 'Revólver', 'Cocina'], // holds suspect + room
        'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
      },
    });

    // First call: play_turn → suggestion
    mockInvokeAgent
      .mockResolvedValueOnce({
        action: { type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
        reasoning: 'test',
        done: true,
      })
      // Second call: refute → show_card (Coronel Mostaza)
      .mockResolvedValueOnce({
        action: { type: 'show_card', card: SOSPECHOSO },
        reasoning: 'I have this card',
        done: true,
      });

    await advanceTurn(gameId);

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.refutadaPor).toBe('team-b');
    expect(sg.cartaMostrada).toBe(SOSPECHOSO);
  });

  it('applies suggestion — refutador returns cannot_refute, cartaMostrada stays null', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
        'team-b': ['Coronel Mostaza', 'Cuerda', 'Comedor'],
        'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
      },
    });

    mockInvokeAgent
      .mockResolvedValueOnce({
        action: { type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
        reasoning: 'test',
        done: true,
      })
      .mockResolvedValueOnce({
        action: { type: 'cannot_refute' },
        reasoning: 'no cards',
        done: true,
      });

    await advanceTurn(gameId);

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    // Even though team-b has SOSPECHOSO, the agent said cannot_refute → null
    expect(sg.cartaMostrada).toBeNull();
  });

  it('advances turnoActual and creates next turn after suggestion', async () => {
    const { gameId } = await setupGame(testDb.db);

    mockInvokeAgent.mockResolvedValue({
      action: { type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
      reasoning: 'test',
      done: true,
    });

    await advanceTurn(gameId);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.turnoActual).toBe(1);

    const allTurnos = await testDb.db.select().from(turnos).where(eq(turnos.partidaId, gameId));
    // Initial turn (completed) + next turn (en_curso)
    expect(allTurnos).toHaveLength(2);
    const nextTurno = allTurnos.find((t) => t.estado === 'en_curso');
    expect(nextTurno).toBeDefined();
    expect(nextTurno!.equipoId).toBe('team-b'); // next team in rotation
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Accusation flow
  // ──────────────────────────────────────────────────────────────────────────

  it('correct accusation finishes the game and marks winner', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    mockInvokeAgent.mockResolvedValue({
      action: { type: 'accusation', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
      reasoning: 'I know the answer',
      done: true,
    });

    const result = await advanceTurn(gameId);

    expect(result.gameOver).toBe(true);
    expect(result.reason).toBe('accusation_correct');

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');

    const [ac] = await testDb.db
      .select()
      .from(acusaciones)
      .where(eq(acusaciones.partidaId, gameId));
    expect(ac.correcta).toBe(true);
    expect(ac.equipoId).toBe('team-a');
  });

  it('incorrect accusation eliminates the team; game continues', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    mockInvokeAgent.mockResolvedValue({
      action: {
        type: 'accusation',
        suspect: SOSPECHOSO_INCORRECTO,
        weapon: ARMA,
        room: HABITACION,
      },
      reasoning: 'wrong guess',
      done: true,
    });

    const result = await advanceTurn(gameId);

    expect(result.gameOver).toBe(false);
    expect(result.reason).toBe('accusation_incorrect');

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('en_curso');

    const [teamA] = await testDb.db
      .select()
      .from(partidaEquipos)
      .where(and(eq(partidaEquipos.partidaId, gameId), eq(partidaEquipos.equipoId, 'team-a')));
    expect(teamA.eliminado).toBe(true);
  });

  it('all teams eliminated → game finalizada without winner', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teams: ['team-a'],
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
      teamCards: { 'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'] },
    });

    mockInvokeAgent.mockResolvedValue({
      action: {
        type: 'accusation',
        suspect: SOSPECHOSO_INCORRECTO,
        weapon: ARMA,
        room: HABITACION,
      },
      reasoning: 'last team wrong guess',
      done: true,
    });

    const result = await advanceTurn(gameId);

    expect(result.gameOver).toBe(true);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────────────────────────────────

  it('throws CoordinatorError(404) for non-existent game', async () => {
    await expect(advanceTurn('fake-game-id')).rejects.toThrow(CoordinatorError);
    await expect(advanceTurn('fake-game-id')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws CoordinatorError(400) when game is not en_curso', async () => {
    const gameId = uuidv4();
    await testDb.db.insert(partidas).values({
      id: gameId,
      nombre: 'Finished',
      estado: 'finalizada',
      turnoActual: 0,
      modoEjecucion: 'manual',
      turnoDelayMs: 3000,
      autoRunActivoDesde: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    await expect(advanceTurn(gameId)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws CoordinatorError(422) when agent returns invalid action type', async () => {
    const { gameId } = await setupGame(testDb.db);

    mockInvokeAgent.mockResolvedValue({
      action: { type: 'show_card', card: 'SomeCard' }, // invalid for play_turn
      reasoning: 'bad',
      done: true,
    });

    await expect(advanceTurn(gameId)).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── MCP tool: get_game_state ──────────────────────────────────────────────────

describe('get_game_state MCP tool', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    mockInvokeAgent.mockReset();
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('returns filtered view — own cards visible, other teams empty', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
        'team-b': ['Reverendo Verde', 'Cuerda', 'Comedor'],
        'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
      },
    });

    const result = await getGameStateTool.handler({ game_id: gameId, team_id: 'team-a' });
    const text = result.content[0].text;
    const view = JSON.parse(text);

    const ownTeam = view.equipos.find((e: { equipoId: string }) => e.equipoId === 'team-a');
    const otherTeam = view.equipos.find((e: { equipoId: string }) => e.equipoId === 'team-b');

    expect(ownTeam.cartas).toHaveLength(3);
    expect(otherTeam.cartas).toHaveLength(0);
  });

  it('returns error for non-participant team', async () => {
    const { gameId } = await setupGame(testDb.db);

    await expect(
      getGameStateTool.handler({ game_id: gameId, team_id: 'outsider' }),
    ).rejects.toThrow();
  });
});

// ── MCP tool: show_card ───────────────────────────────────────────────────────

describe('show_card MCP tool', () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    mockInvokeAgent.mockReset();
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('allows the suggester to see cartaMostrada', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Señora Pavo Real', 'Revólver', 'Billar'],
        'team-b': ['Coronel Mostaza', 'Cuerda', 'Comedor'],
        'team-c': ['Señora Blanca', 'Llave inglesa', 'Salón'],
      },
    });

    // Create a suggestion
    const turnoId = (
      await testDb.db.select().from(turnos).where(eq(turnos.partidaId, gameId))
    )[0].id;
    const sgId = uuidv4();
    await testDb.db.insert(sugerencias).values({
      id: sgId,
      turnoId,
      partidaId: gameId,
      equipoId: 'team-a',
      sospechoso: SOSPECHOSO,
      arma: ARMA,
      habitacion: HABITACION,
      refutadaPor: 'team-b',
      cartaMostrada: SOSPECHOSO,
      createdAt: new Date(),
    });

    const result = await showCardTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suggestion_id: sgId,
    });
    const text = result.content[0].text;
    const data = JSON.parse(text);

    expect(data.cartaMostrada).toBe(SOSPECHOSO);
    expect(data.refutadaPor).toBe('team-b');
  });

  it('throws 403 when a non-suggester tries to read cartaMostrada', async () => {
    const { gameId } = await setupGame(testDb.db);

    const turnoId = (
      await testDb.db.select().from(turnos).where(eq(turnos.partidaId, gameId))
    )[0].id;
    const sgId = uuidv4();
    await testDb.db.insert(sugerencias).values({
      id: sgId,
      turnoId,
      partidaId: gameId,
      equipoId: 'team-a',
      sospechoso: SOSPECHOSO,
      arma: ARMA,
      habitacion: HABITACION,
      refutadaPor: 'team-b',
      cartaMostrada: SOSPECHOSO,
      createdAt: new Date(),
    });

    await expect(
      showCardTool.handler({ game_id: gameId, team_id: 'team-b', suggestion_id: sgId }),
    ).rejects.toThrow();
  });
});
