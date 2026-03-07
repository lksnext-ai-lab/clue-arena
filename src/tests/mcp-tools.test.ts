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

// ── Logger mock (F012 — avoid pino initialization in tests) ──────────────────
vi.mock('@/lib/utils/log', () => ({
  logInvocacionValidity: vi.fn(),
}));

/** Wraps an agent action in the F012 invokeAgent return format */
function agentResult(action: Record<string, unknown>) {
  return { response: { action, reasoning: 'test', done: true }, invocacionId: 'test-inv-id' };
}

// ── Import after mocks ────────────────────────────────────────────────────────
import { advanceTurn, CoordinatorError } from '@/lib/game/coordinator';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { makeSuggestionTool } from '@/lib/mcp/tools/make-suggestion';
import { makeAccusationTool } from '@/lib/mcp/tools/make-accusation';
import { showCardTool } from '@/lib/mcp/tools/show-card';
import { saveAgentMemoryTool } from '@/lib/mcp/tools/save-agent-memory';
import { getAgentMemoryTool } from '@/lib/mcp/tools/get-agent-memory';

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
  agentMemories,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ── Constants ────────────────────────────────────────────────────────────────
const SOSPECHOSO = 'Coronel Mustard';
const ARMA = 'Teclado mecánico';
const HABITACION = 'La Cafetería';
const SOSPECHOSO_INCORRECTO = 'Directora Scarlett';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupGame(
  db: ReturnType<typeof createTestDb>['db'],
  opts: {
    teams?: string[];
    envelop?: { sospechoso: string; arma: string; habitacion: string };
    teamCards?: Record<string, string[]>;
    maxTurnos?: number | null;
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
    maxTurnos: opts.maxTurnos ?? null,
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
    'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
    'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
    'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
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
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    // Suggestion with cards nobody holds
    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION }),
    );

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
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Cable de red', 'La Cafetería'], // holds suspect + room
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    // First call: play_turn → suggestion
    mockInvokeAgent
      .mockResolvedValueOnce(
        agentResult({ type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION }),
      )
      // Second call: refute → show_card (Coronel Mustard)
      .mockResolvedValueOnce(
        agentResult({ type: 'show_card', card: SOSPECHOSO }),
      );

    await advanceTurn(gameId);

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.refutadaPor).toBe('team-b');
    expect(sg.cartaMostrada).toBe(SOSPECHOSO);
  });

  it('applies suggestion — refutador returns cannot_refute, cartaMostrada stays null', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    mockInvokeAgent
      .mockResolvedValueOnce(
        agentResult({ type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION }),
      )
      .mockResolvedValueOnce(
        agentResult({ type: 'cannot_refute' }),
      );

    await advanceTurn(gameId);

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    // Even though team-b has SOSPECHOSO, the agent said cannot_refute → null
    expect(sg.cartaMostrada).toBeNull();
  });

  it('advances turnoActual and creates next turn after suggestion', async () => {
    const { gameId } = await setupGame(testDb.db);

    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'suggestion', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION }),
    );

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

    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'accusation', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION }),
    );

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

    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'accusation', suspect: SOSPECHOSO_INCORRECTO, weapon: ARMA, room: HABITACION }),
    );

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
      teamCards: { 'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'] },
    });

    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'accusation', suspect: SOSPECHOSO_INCORRECTO, weapon: ARMA, room: HABITACION }),
    );

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

    mockInvokeAgent.mockResolvedValue(
      agentResult({ type: 'show_card', card: 'SomeCard' }), // invalid for play_turn
    );

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
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    const result = await getGameStateTool.handler({ game_id: gameId, team_id: 'team-a' });
    const text = result.content[0].text;
    const view = JSON.parse(text);

    // default maxTurnos was not set
    expect(view.maxTurnos).toBeNull();

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

  it('propagates a non-null maxTurnos value', async () => {
    const { gameId } = await setupGame(testDb.db, { maxTurnos: 10 });
    const res = await getGameStateTool.handler({ game_id: gameId, team_id: 'team-a' });
    const view = JSON.parse(res.content[0].text);
    expect(view.maxTurnos).toBe(10);
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
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
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

// ── MCP tool: make_suggestion ─────────────────────────────────────────────────

describe('make_suggestion MCP tool', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('persists suggestion with no refutador when no team holds the matching cards', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    const result = await makeSuggestionTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.refutada).toBe(false);
    expect(data.refutadaPor).toBeNull();

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.sospechoso).toBe(SOSPECHOSO);
    expect(sg.arma).toBe(ARMA);
    expect(sg.habitacion).toBe(HABITACION);
    expect(sg.refutadaPor).toBeNull();
    expect(sg.cartaMostrada).toBeNull();
  });

  it('identifies the first refutador in turn order that holds a matching card', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Teclado mecánico', 'Recursos Humanos'], // holds SOSPECHOSO + ARMA
        'team-c': ['Sra. White', 'Termo de acero', 'La Cafetería'],            // holds HABITACION
      },
    });

    const result = await makeSuggestionTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.refutada).toBe(true);
    // team-b is next in order and holds a matching card → should be the refutador
    expect(data.refutadaPor).toBe('team-b');

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.refutadaPor).toBe('team-b');
    // cartaMostrada must be one of the three suggestion cards
    expect([SOSPECHOSO, ARMA, HABITACION]).toContain(sg.cartaMostrada);
  });

  it('skips eliminated teams when searching for refutador', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Grapadora industrial', 'Recursos Humanos'], // holds SOSPECHOSO
        'team-c': ['Sra. White', 'Teclado mecánico', 'El Almacén de IT'],           // holds ARMA
      },
    });

    // Eliminate team-b
    await testDb.db
      .update(partidaEquipos)
      .set({ eliminado: true })
      .where(and(eq(partidaEquipos.partidaId, gameId), eq(partidaEquipos.equipoId, 'team-b')));

    const result = await makeSuggestionTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    // team-b is skipped → team-c is refutador (holds ARMA)
    expect(data.refutadaPor).toBe('team-c');
  });

  it('throws when there is no active turn for the team', async () => {
    const { gameId } = await setupGame(testDb.db);

    await expect(
      makeSuggestionTool.handler({
        game_id: gameId,
        team_id: 'team-b', // turn belongs to team-a, not team-b
        suspect: SOSPECHOSO,
        weapon: ARMA,
        room: HABITACION,
      }),
    ).rejects.toThrow('No hay turno activo');
  });

  it('throws when game is not en_curso', async () => {
    const gameId = uuidv4();
    await testDb.db.insert(partidas).values({
      id: gameId,
      nombre: 'Finished',
      estado: 'finalizada',
      turnoActual: 0,
      modoEjecucion: 'manual',
      turnoDelayMs: 0,
      autoRunActivoDesde: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    await expect(
      makeSuggestionTool.handler({
        game_id: gameId,
        team_id: 'team-a',
        suspect: SOSPECHOSO,
        weapon: ARMA,
        room: HABITACION,
      }),
    ).rejects.toThrow('no en curso');
  });
});

// ── MCP tool: make_accusation ─────────────────────────────────────────────────

describe('make_accusation MCP tool', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('correct accusation: marks game finalizada, awards 100 points, returns correcta=true', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    const result = await makeAccusationTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.correcta).toBe(true);
    expect(data.ganador).toBe('team-a');
    expect(data.eliminado).toBe(false);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');

    const [teamA] = await testDb.db
      .select()
      .from(partidaEquipos)
      .where(and(eq(partidaEquipos.partidaId, gameId), eq(partidaEquipos.equipoId, 'team-a')));
    expect(teamA.puntos).toBe(100);
    expect(teamA.eliminado).toBe(false);
  });

  it('incorrect accusation: eliminates the team, game stays en_curso', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    const result = await makeAccusationTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO_INCORRECTO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.correcta).toBe(false);
    expect(data.ganador).toBeNull();
    expect(data.eliminado).toBe(true);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('en_curso');

    const [teamA] = await testDb.db
      .select()
      .from(partidaEquipos)
      .where(and(eq(partidaEquipos.partidaId, gameId), eq(partidaEquipos.equipoId, 'team-a')));
    expect(teamA.eliminado).toBe(true);
  });

  it('incorrect accusation with last remaining team: finalizes game with no winner', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teams: ['team-a'],
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
      teamCards: { 'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'] },
    });

    const result = await makeAccusationTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO_INCORRECTO,
      weapon: ARMA,
      room: HABITACION,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.correcta).toBe(false);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');
  });

  it('persists accusation row in DB with correct fields', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    await makeAccusationTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const [ac] = await testDb.db.select().from(acusaciones).where(eq(acusaciones.partidaId, gameId));
    expect(ac.equipoId).toBe('team-a');
    expect(ac.sospechoso).toBe(SOSPECHOSO);
    expect(ac.arma).toBe(ARMA);
    expect(ac.habitacion).toBe(HABITACION);
    expect(ac.correcta).toBe(true);
  });

  it('marks the active turn as completado after accusation', async () => {
    const { gameId, turnoId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    await makeAccusationTool.handler({
      game_id: gameId,
      team_id: 'team-a',
      suspect: SOSPECHOSO,
      weapon: ARMA,
      room: HABITACION,
    });

    const [turno] = await testDb.db.select().from(turnos).where(eq(turnos.id, turnoId));
    expect(turno.estado).toBe('completado');
    expect(turno.finishedAt).not.toBeNull();
  });

  it('throws when there is no active turn for the team', async () => {
    const { gameId } = await setupGame(testDb.db);

    await expect(
      makeAccusationTool.handler({
        game_id: gameId,
        team_id: 'team-b', // turn belongs to team-a
        suspect: SOSPECHOSO,
        weapon: ARMA,
        room: HABITACION,
      }),
    ).rejects.toThrow('No hay turno activo');
  });

  it('throws when game is not en_curso', async () => {
    const gameId = uuidv4();
    await testDb.db.insert(partidas).values({
      id: gameId,
      nombre: 'Finished',
      estado: 'finalizada',
      turnoActual: 0,
      modoEjecucion: 'manual',
      turnoDelayMs: 0,
      autoRunActivoDesde: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    await expect(
      makeAccusationTool.handler({
        game_id: gameId,
        team_id: 'team-a',
        suspect: SOSPECHOSO,
        weapon: ARMA,
        room: HABITACION,
      }),
    ).rejects.toThrow('no en curso');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MCP tool — save_agent_memory / get_agent_memory
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP tool — save_agent_memory / get_agent_memory', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('get_agent_memory returns empty object when no row exists', async () => {
    const result = await getAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.memory).toEqual({});
    expect(parsed.updatedAt).toBeNull();
  });

  it('save_agent_memory inserts a new row and get_agent_memory retrieves it', async () => {
    const memory = { cards_seen: ['Coronel Mustard', 'Teclado mecánico'], confidence: 0.85 };

    await saveAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
      memory,
    });

    const result = await getAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.memory).toEqual(memory);
    expect(parsed.updatedAt).not.toBeNull();
  });

  it('save_agent_memory upserts — second call overwrites without creating a duplicate row', async () => {
    await saveAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
      memory: { step: 1 },
    });

    await saveAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
      memory: { step: 2, extra: true },
    });

    const rows = await testDb.db.select().from(agentMemories);
    expect(rows).toHaveLength(1);

    const result = await getAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
    });
    expect(JSON.parse(result.content[0].text).memory).toEqual({ step: 2, extra: true });
  });

  it('save_agent_memory returns ok:true with updatedAt timestamp', async () => {
    const result = await saveAgentMemoryTool.handler({
      game_id: 'game-1',
      team_id: 'team-1',
      memory: { note: 'hello' },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.updatedAt).toBe('string');
  });

  it('memories are isolated per (game_id, team_id)', async () => {
    await saveAgentMemoryTool.handler({ game_id: 'game-1', team_id: 'team-a', memory: { src: 'a' } });
    await saveAgentMemoryTool.handler({ game_id: 'game-1', team_id: 'team-b', memory: { src: 'b' } });
    await saveAgentMemoryTool.handler({ game_id: 'game-2', team_id: 'team-a', memory: { src: 'c' } });

    const r1 = JSON.parse(
      (await getAgentMemoryTool.handler({ game_id: 'game-1', team_id: 'team-a' })).content[0].text,
    );
    const r2 = JSON.parse(
      (await getAgentMemoryTool.handler({ game_id: 'game-1', team_id: 'team-b' })).content[0].text,
    );
    const r3 = JSON.parse(
      (await getAgentMemoryTool.handler({ game_id: 'game-2', team_id: 'team-a' })).content[0].text,
    );

    expect(r1.memory).toEqual({ src: 'a' });
    expect(r2.memory).toEqual({ src: 'b' });
    expect(r3.memory).toEqual({ src: 'c' });
  });
});
