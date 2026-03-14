import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from './db';
import type { TestDb } from './db';
import { v4 as uuidv4 } from 'uuid';

const testDbContainer: { db: ReturnType<typeof createTestDb>['db'] | null } = { db: null };
vi.mock('@/lib/db', () => ({
  get db() {
    return testDbContainer.db;
  },
}));

import { GET } from '@/app/api/ranking/route';
import {
  equipos,
  partidas,
  scoreEvents,
  tournaments,
  tournamentRoundGames,
  tournamentRounds,
  tournamentTeams,
  usuarios,
} from '@/lib/db/schema';

async function insertOwner(db: TestDb['db']) {
  const id = uuidv4();
  await db.insert(usuarios).values({
    id,
    email: `${id}@example.com`,
    nombre: `Owner ${id.slice(0, 4)}`,
    rol: 'equipo',
    createdAt: new Date(),
  });
  return id;
}

async function insertTeam(db: TestDb['db'], nombre: string) {
  const ownerId = await insertOwner(db);
  const id = uuidv4();
  await db.insert(equipos).values({
    id,
    nombre,
    descripcion: null,
    agentId: `agent-${nombre}`,
    avatarUrl: null,
    miembros: '[]',
    usuarioId: ownerId,
    estado: 'registrado',
    createdAt: new Date(),
  });
  return id;
}

async function insertFinishedGame(db: TestDb['db'], nombre: string) {
  const id = uuidv4();
  await db.insert(partidas).values({
    id,
    nombre,
    estado: 'finalizada',
    turnoActual: 5,
    maxTurnos: 20,
    modoEjecucion: 'manual',
    turnoDelayMs: 0,
    autoRunActivoDesde: null,
    createdAt: new Date(),
    startedAt: new Date(),
    finishedAt: new Date(),
  });
  return id;
}

describe('GET /api/ranking', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('filters ranking by tournament and excludes unrelated games and teams', async () => {
    const teamA = await insertTeam(testDb.db, 'Alpha');
    const teamB = await insertTeam(testDb.db, 'Beta');
    const teamC = await insertTeam(testDb.db, 'Gamma');

    const tournamentId = uuidv4();
    const roundId = uuidv4();
    const scopedGameId = await insertFinishedGame(testDb.db, 'Scoped game');
    const outsideGameId = await insertFinishedGame(testDb.db, 'Outside game');

    await testDb.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Liga Primavera',
      format: 'round_robin',
      status: 'active',
      config: JSON.stringify({ format: 'round_robin', rounds: 3, playersPerGame: 3, maxTurnsPerGame: 30 }),
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
    });

    await testDb.db.insert(tournamentTeams).values([
      { id: uuidv4(), tournamentId, teamId: teamA, seed: 1, groupIndex: null, eliminated: false },
      { id: uuidv4(), tournamentId, teamId: teamB, seed: 2, groupIndex: null, eliminated: false },
    ]);

    await testDb.db.insert(tournamentRounds).values({
      id: roundId,
      tournamentId,
      roundNumber: 1,
      phase: 'round',
      status: 'finished',
      generatedAt: new Date(),
      finishedAt: new Date(),
    });

    await testDb.db.insert(tournamentRoundGames).values({
      id: uuidv4(),
      roundId,
      gameId: scopedGameId,
      isBye: false,
    });

    await testDb.db.insert(scoreEvents).values([
      { gameId: scopedGameId, equipoId: teamA, turno: 1, type: 'EVT_WIN', points: 5, meta: null, createdAt: new Date() },
      { gameId: scopedGameId, equipoId: teamB, turno: 1, type: 'EVT_REFUTATION', points: 2, meta: null, createdAt: new Date() },
      { gameId: outsideGameId, equipoId: teamB, turno: 1, type: 'EVT_WIN', points: 10, meta: null, createdAt: new Date() },
      { gameId: outsideGameId, equipoId: teamC, turno: 1, type: 'EVT_WIN', points: 7, meta: null, createdAt: new Date() },
    ]);

    const response = await GET(new Request(`http://localhost/api/ranking?tournamentId=${tournamentId}`));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.scope).toBe('tournament');
    expect(payload.tournament).toEqual({ id: tournamentId, name: 'Liga Primavera' });
    expect(payload.ranking).toHaveLength(2);
    expect(payload.ranking.map((entry: { equipoNombre: string }) => entry.equipoNombre)).toEqual(['Alpha', 'Beta']);
    expect(payload.ranking.map((entry: { puntos: number }) => entry.puntos)).toEqual([5, 2]);
  });

  it('returns 404 when the tournament does not exist', async () => {
    const response = await GET(new Request('http://localhost/api/ranking?tournamentId=missing'));
    expect(response.status).toBe(404);
  });
});
