/**
 * MCP protocol-level integration tests.
 *
 * Tests all six built-in MCP tools end-to-end using the official
 * @modelcontextprotocol/sdk Client + InMemoryTransport pair.
 *
 * Each describe block spins up a fresh McpServer instance so test suites are
 * fully isolated from the production singleton in src/lib/mcp/server.ts.
 *
 * Database access uses the same in-memory SQLite helper used by the direct
 * handler tests in mcp-tools.test.ts.  The two suites are complementary:
 *  - mcp-tools.test.ts  → direct handler invocation (unit-level)
 *  - mcp-client.test.ts → full MCP request/response cycle (protocol-level)
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

// ── Logger mock (avoids pino initialisation side-effects) ────────────────────
vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
  agentLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mcpLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/crypto', () => ({
  hashSHA256: vi.fn((s: string) => `sha256:mock-${s.length}`),
}));

// ── MCP SDK  ──────────────────────────────────────────────────────────────────
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// ── MCP server factory ────────────────────────────────────────────────────────
import { createMcpServer } from '@/lib/mcp/server';

// ── Schema / helpers ──────────────────────────────────────────────────────────
import {
  usuarios,
  equipos,
  partidas,
  partidaEquipos,
  sobres,
  turnos,
  sugerencias,
  agentMemories,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ── Constants ─────────────────────────────────────────────────────────────────
const SOSPECHOSO = 'Coronel Mustard';
const ARMA = 'Teclado mecánico';
const HABITACION = 'La Cafetería';
const SOSPECHOSO_INCORRECTO = 'Directora Scarlett';

/**
 * Connect a fresh Client to a fresh McpServer over an in-memory transport
 * pair.  Returns the client and a teardown function.
 */
async function createMcpPair(): Promise<{ client: Client; teardown: () => Promise<void> }> {
  const server = createMcpServer();
  const client = new Client({ name: 'test-client', version: '0.0.0' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    teardown: async () => {
      await client.close();
    },
  };
}

/** Parse the first text content item from a CallToolResult. */
function parseTextContent(result: unknown): unknown {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  const first = r.content?.find((c) => c.type === 'text');
  if (!first?.text) throw new Error('No text content in result');
  return JSON.parse(first.text);
}

// ── Game setup helper (mirrors mcp-tools.test.ts setupGame) ──────────────────

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

  const userId = uuidv4();
  await db.insert(usuarios).values({
    id: userId,
    email: 'test@test.com',
    nombre: 'Test User',
    rol: 'equipo',
    createdAt: new Date(),
  });

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

  await db.insert(sobres).values({
    id: uuidv4(),
    partidaId: gameId,
    sospechoso: envelop.sospechoso,
    arma: envelop.arma,
    habitacion: envelop.habitacion,
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// get_game_state
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — get_game_state', () => {
  let testDb: TestDb;
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
    testDb.close();
    testDbContainer.db = null;
  });

  it('returns filtered view: own cards visible, other team cards hidden', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    const result = await client.callTool({
      name: 'get_game_state',
      arguments: { game_id: gameId, team_id: 'team-a' },
    });

    expect(result.isError).toBeFalsy();
    const view = parseTextContent(result) as { equipos: Array<{ equipoId: string; cartas: string[] }> };

    const ownTeam = view.equipos.find((e) => e.equipoId === 'team-a');
    const otherTeam = view.equipos.find((e) => e.equipoId === 'team-b');

    expect(ownTeam?.cartas).toHaveLength(3);
    expect(otherTeam?.cartas).toHaveLength(0);
  });

  it('returns isError for a team not in the game', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'get_game_state',
      arguments: { game_id: gameId, team_id: 'outsider' },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError for a non-existent game', async () => {
    const result = await client.callTool({
      name: 'get_game_state',
      arguments: { game_id: 'does-not-exist', team_id: 'team-a' },
    });

    expect(result.isError).toBe(true);
  });

  it('game_id content field includes gameId and estado', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'get_game_state',
      arguments: { game_id: gameId, team_id: 'team-a' },
    });

    const view = parseTextContent(result) as Record<string, unknown>;
    expect(view).toHaveProperty('gameId', gameId);
    expect(view).toHaveProperty('estado', 'en_curso');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// make_suggestion
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — make_suggestion', () => {
  let testDb: TestDb;
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
    testDb.close();
    testDbContainer.db = null;
  });

  it('persists suggestion with no refutador when no team holds the cards', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Sr. Green', 'Grapadora industrial', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    const result = await client.callTool({
      name: 'make_suggestion',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { refutada: boolean; refutadaPor: string | null };

    expect(data.refutada).toBe(false);
    expect(data.refutadaPor).toBeNull();

    const [sg] = await testDb.db.select().from(sugerencias).where(eq(sugerencias.partidaId, gameId));
    expect(sg.sospechoso).toBe(SOSPECHOSO);
    expect(sg.refutadaPor).toBeNull();
  });

  it('identifies the first refutador in turn order', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teamCards: {
        'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'],
        'team-b': ['Coronel Mustard', 'Teclado mecánico', 'Recursos Humanos'],
        'team-c': ['Sra. White', 'Termo de acero', 'El Almacén de IT'],
      },
    });

    const result = await client.callTool({
      name: 'make_suggestion',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { refutada: boolean; refutadaPor: string };
    expect(data.refutada).toBe(true);
    expect(data.refutadaPor).toBe('team-b');
  });

  it('returns isError when there is no active turn for the requesting team', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'make_suggestion',
      arguments: { game_id: gameId, team_id: 'team-b', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError when game is not en_curso', async () => {
    const gameId = uuidv4();
    await testDb.db.insert(partidas).values({
      id: gameId, nombre: 'Finished', estado: 'finalizada',
      turnoActual: 0, modoEjecucion: 'manual', turnoDelayMs: 0,
      autoRunActivoDesde: null, createdAt: new Date(), startedAt: new Date(), finishedAt: new Date(),
    });

    const result = await client.callTool({
      name: 'make_suggestion',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError when suspect enum value is invalid (schema validation)', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'make_suggestion',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: 'Invalid Name', weapon: ARMA, room: HABITACION },
    });

    // Schema validation should reject the call
    expect(result.isError).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// show_card
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — show_card', () => {
  let testDb: TestDb;
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
    testDb.close();
    testDbContainer.db = null;
  });

  /** Create a suggestion row directly in the DB and return its id. */
  async function insertSuggestion(
    gameId: string,
    turnoId: string,
    opts: { cartaMostrada?: string | null; refutadaPor?: string | null } = {},
  ) {
    const sgId = uuidv4();
    await testDb.db.insert(sugerencias).values({
      id: sgId,
      turnoId,
      partidaId: gameId,
      equipoId: 'team-a',
      sospechoso: SOSPECHOSO,
      arma: ARMA,
      habitacion: HABITACION,
      refutadaPor: 'refutadaPor' in opts ? opts.refutadaPor : 'team-b',
      cartaMostrada: 'cartaMostrada' in opts ? opts.cartaMostrada : SOSPECHOSO,
      createdAt: new Date(),
    });
    return sgId;
  }

  it('returns cartaMostrada to the team that made the suggestion', async () => {
    const { gameId, turnoId } = await setupGame(testDb.db);
    const sgId = await insertSuggestion(gameId, turnoId);

    const result = await client.callTool({
      name: 'show_card',
      arguments: { game_id: gameId, team_id: 'team-a', suggestion_id: sgId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { cartaMostrada: string; refutadaPor: string };
    expect(data.cartaMostrada).toBe(SOSPECHOSO);
    expect(data.refutadaPor).toBe('team-b');
  });

  it('returns isError when a non-suggester tries to read cartaMostrada', async () => {
    const { gameId, turnoId } = await setupGame(testDb.db);
    const sgId = await insertSuggestion(gameId, turnoId);

    const result = await client.callTool({
      name: 'show_card',
      arguments: { game_id: gameId, team_id: 'team-b', suggestion_id: sgId },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError for a non-existent suggestion_id', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'show_card',
      arguments: { game_id: gameId, team_id: 'team-a', suggestion_id: 'does-not-exist' },
    });

    expect(result.isError).toBe(true);
  });

  it('cartaMostrada is null when no card was shown (cannot_refute)', async () => {
    const { gameId, turnoId } = await setupGame(testDb.db);
    const sgId = await insertSuggestion(gameId, turnoId, { cartaMostrada: null, refutadaPor: null });

    const result = await client.callTool({
      name: 'show_card',
      arguments: { game_id: gameId, team_id: 'team-a', suggestion_id: sgId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { cartaMostrada: string | null; refutadaPor: string | null };
    expect(data.cartaMostrada).toBeNull();
    expect(data.refutadaPor).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// make_accusation
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — make_accusation', () => {
  let testDb: TestDb;
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
    testDb.close();
    testDbContainer.db = null;
  });

  it('correct accusation returns correcta=true and winner, finalises game', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    const result = await client.callTool({
      name: 'make_accusation',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { correcta: boolean; ganador: string | null; eliminado: boolean };
    expect(data.correcta).toBe(true);
    expect(data.ganador).toBe('team-a');
    expect(data.eliminado).toBe(false);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');
  });

  it('incorrect accusation returns correcta=false, eliminates team, game stays en_curso', async () => {
    const { gameId } = await setupGame(testDb.db, {
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
    });

    const result = await client.callTool({
      name: 'make_accusation',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO_INCORRECTO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { correcta: boolean; eliminado: boolean };
    expect(data.correcta).toBe(false);
    expect(data.eliminado).toBe(true);

    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('en_curso');

    const [teamA] = await testDb.db
      .select()
      .from(partidaEquipos)
      .where(and(eq(partidaEquipos.partidaId, gameId), eq(partidaEquipos.equipoId, 'team-a')));
    expect(teamA.eliminado).toBe(true);
  });

  it('incorrect accusation with last team finalises game without winner', async () => {
    const { gameId } = await setupGame(testDb.db, {
      teams: ['team-a'],
      envelop: { sospechoso: SOSPECHOSO, arma: ARMA, habitacion: HABITACION },
      teamCards: { 'team-a': ['Dra. Peacock', 'Cable de red', 'El Open Space'] },
    });

    const result = await client.callTool({
      name: 'make_accusation',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO_INCORRECTO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBeFalsy();
    const [partida] = await testDb.db.select().from(partidas).where(eq(partidas.id, gameId));
    expect(partida.estado).toBe('finalizada');
  });

  it('returns isError when there is no active turn for the team', async () => {
    const { gameId } = await setupGame(testDb.db);

    const result = await client.callTool({
      name: 'make_accusation',
      arguments: { game_id: gameId, team_id: 'team-b', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBe(true);
  });

  it('returns isError when game is finalizada', async () => {
    const gameId = uuidv4();
    await testDb.db.insert(partidas).values({
      id: gameId, nombre: 'Done', estado: 'finalizada',
      turnoActual: 0, modoEjecucion: 'manual', turnoDelayMs: 0,
      autoRunActivoDesde: null, createdAt: new Date(), startedAt: new Date(), finishedAt: new Date(),
    });

    const result = await client.callTool({
      name: 'make_accusation',
      arguments: { game_id: gameId, team_id: 'team-a', suspect: SOSPECHOSO, weapon: ARMA, room: HABITACION },
    });

    expect(result.isError).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// save_agent_memory / get_agent_memory
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — save_agent_memory / get_agent_memory', () => {
  let testDb: TestDb;
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
    testDb.close();
    testDbContainer.db = null;
  });

  it('get_agent_memory returns empty object when no row exists', async () => {
    const result = await client.callTool({
      name: 'get_agent_memory',
      arguments: { game_id: 'game-x', team_id: 'team-x' },
    });

    expect(result.isError).toBeFalsy();
    const data = parseTextContent(result) as { memory: Record<string, unknown>; updatedAt: string | null };
    expect(data.memory).toEqual({});
    expect(data.updatedAt).toBeNull();
  });

  it('save then get returns the stored memory object', async () => {
    const memory = { notes: ['Coronel Mustard seen in cafetería'], confidence: 0.7 };

    const saveResult = await client.callTool({
      name: 'save_agent_memory',
      arguments: { game_id: 'game-1', team_id: 'team-a', memory },
    });

    expect(saveResult.isError).toBeFalsy();
    const saved = parseTextContent(saveResult) as { ok: boolean; updatedAt: string };
    expect(saved.ok).toBe(true);
    expect(typeof saved.updatedAt).toBe('string');

    const getResult = await client.callTool({
      name: 'get_agent_memory',
      arguments: { game_id: 'game-1', team_id: 'team-a' },
    });

    const got = parseTextContent(getResult) as { memory: typeof memory; updatedAt: string };
    expect(got.memory).toEqual(memory);
    expect(got.updatedAt).toBe(saved.updatedAt);
  });

  it('second save_agent_memory overwrites without creating duplicate rows', async () => {
    await client.callTool({
      name: 'save_agent_memory',
      arguments: { game_id: 'game-1', team_id: 'team-a', memory: { step: 1 } },
    });

    await client.callTool({
      name: 'save_agent_memory',
      arguments: { game_id: 'game-1', team_id: 'team-a', memory: { step: 2 } },
    });

    const rows = await testDb.db.select().from(agentMemories);
    expect(rows).toHaveLength(1);

    const getResult = await client.callTool({
      name: 'get_agent_memory',
      arguments: { game_id: 'game-1', team_id: 'team-a' },
    });

    const got = parseTextContent(getResult) as { memory: { step: number } };
    expect(got.memory.step).toBe(2);
  });

  it('memories are isolated per (game_id, team_id)', async () => {
    await client.callTool({ name: 'save_agent_memory', arguments: { game_id: 'g1', team_id: 'ta', memory: { v: 1 } } });
    await client.callTool({ name: 'save_agent_memory', arguments: { game_id: 'g1', team_id: 'tb', memory: { v: 2 } } });
    await client.callTool({ name: 'save_agent_memory', arguments: { game_id: 'g2', team_id: 'ta', memory: { v: 3 } } });

    const r1 = parseTextContent(await client.callTool({ name: 'get_agent_memory', arguments: { game_id: 'g1', team_id: 'ta' } })) as { memory: { v: number } };
    const r2 = parseTextContent(await client.callTool({ name: 'get_agent_memory', arguments: { game_id: 'g1', team_id: 'tb' } })) as { memory: { v: number } };
    const r3 = parseTextContent(await client.callTool({ name: 'get_agent_memory', arguments: { game_id: 'g2', team_id: 'ta' } })) as { memory: { v: number } };

    expect(r1.memory.v).toBe(1);
    expect(r2.memory.v).toBe(2);
    expect(r3.memory.v).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Protocol-level: tool listing and unknown tool names
// ─────────────────────────────────────────────────────────────────────────────

describe('MCP client — protocol-level tool discovery', () => {
  let client: Client;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    ({ client, teardown } = await createMcpPair());
  });

  afterEach(async () => {
    await teardown();
  });

  it('lists exactly the six expected tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'get_agent_memory',
      'get_game_state',
      'make_accusation',
      'make_suggestion',
      'save_agent_memory',
      'show_card',
    ]);
  });

  it('each tool exposes an inputSchema', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('calling an unknown tool name returns isError', async () => {
    // The MCP protocol resolves with an error result rather than rejecting.
    const result = await client.callTool({ name: 'non_existent_tool', arguments: {} });
    expect(result.isError).toBe(true);
    const content = (result as unknown as { content: Array<{ type: string; text?: string }> }).content;
    const text = content?.find((c) => c.type === 'text')?.text ?? '';
    expect(text).toMatch(/not found/i);
  });
});
