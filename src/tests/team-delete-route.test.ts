import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb } from './db';
import type { TestDb } from './db';

const testDbContainer: { db: ReturnType<typeof createTestDb>['db'] | null } = { db: null };
const getAuthSessionMock = vi.fn();

vi.mock('@/lib/db', () => ({
  get db() {
    return testDbContainer.db;
  },
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthSession: () => getAuthSessionMock(),
}));

import { DELETE } from '@/app/api/teams/[id]/route';
import {
  agentMemories,
  equipos,
  partidaEquipos,
  partidas,
  partidasEntrenamiento,
  usuarios,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function insertUser(
  db: TestDb['db'],
  overrides: Partial<typeof usuarios.$inferInsert> = {},
) {
  const user: typeof usuarios.$inferInsert = {
    id: uuidv4(),
    email: `${uuidv4()}@example.com`,
    nombre: 'Admin',
    rol: 'admin',
    createdAt: new Date(),
    ...overrides,
  };

  await db.insert(usuarios).values(user);
  return user;
}

async function insertTeam(
  db: TestDb['db'],
  ownerId: string,
  overrides: Partial<typeof equipos.$inferInsert> = {},
) {
  const team: typeof equipos.$inferInsert = {
    id: uuidv4(),
    nombre: `Team-${uuidv4().slice(0, 8)}`,
    descripcion: 'Equipo con historial',
    agentId: 'agent-demo',
    agentBackend: 'mattin',
    appId: 'app-demo',
    mattinApiKey: 'secret-key',
    avatarUrl: null,
    miembros: JSON.stringify(['ada@example.com']),
    usuarioId: ownerId,
    estado: 'activo',
    createdAt: new Date(),
    ...overrides,
  };

  await db.insert(equipos).values(team);
  return team;
}

describe('DELETE /api/teams/:id', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    getAuthSessionMock.mockReset();
    getAuthSessionMock.mockResolvedValue({
      user: {
        id: 'admin-id',
        name: 'Admin',
        email: 'admin@example.com',
        rol: 'admin',
        equipo: null,
      },
    });
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('hard deletes teams that have no shared official activity', async () => {
    const owner = await insertUser(testDb.db, { rol: 'equipo' });
    const team = await insertTeam(testDb.db, owner.id);

    await testDb.db.insert(partidasEntrenamiento).values({
      id: uuidv4(),
      equipoId: team.id,
      estado: 'finalizada',
      numBots: 2,
      maxTurnos: 20,
      seed: null,
      sobresJson: null,
      resultadoJson: null,
      motivoAbort: null,
      createdAt: new Date(),
      finishedAt: new Date(),
    });

    await testDb.db.insert(agentMemories).values({
      gameId: 'training-game-1',
      teamId: team.id,
      memoryJson: '{}',
      updatedAt: new Date().toISOString(),
    });

    const response = await DELETE(
      new Request(`http://localhost/api/teams/${team.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: team.id }) }
    );

    expect(response.status).toBe(204);

    const storedTeam = await testDb.db.select().from(equipos).where(eq(equipos.id, team.id)).get();
    expect(storedTeam).toBeUndefined();

    const trainingRows = await testDb.db
      .select()
      .from(partidasEntrenamiento)
      .where(eq(partidasEntrenamiento.equipoId, team.id));
    expect(trainingRows).toHaveLength(0);

    const memories = await testDb.db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.teamId, team.id));
    expect(memories).toHaveLength(0);
  });

  it('archives teams that are referenced by official history and only cleans private data', async () => {
    const owner = await insertUser(testDb.db, { rol: 'equipo' });
    const team = await insertTeam(testDb.db, owner.id);
    const gameId = uuidv4();

    await testDb.db.insert(partidas).values({
      id: gameId,
      nombre: 'Partida finalizada',
      estado: 'finalizada',
      turnoActual: 5,
      maxTurnos: 10,
      modoEjecucion: 'manual',
      turnoDelayMs: 3000,
      autoRunActivoDesde: null,
      turnoEnProcesoToken: null,
      turnoEnProcesoDesde: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    await testDb.db.insert(partidaEquipos).values({
      id: uuidv4(),
      partidaId: gameId,
      equipoId: team.id,
      orden: 1,
      eliminado: false,
      eliminacionRazon: null,
      warnings: 0,
      puntos: 12,
      cartas: '[]',
    });

    await testDb.db.insert(partidasEntrenamiento).values({
      id: uuidv4(),
      equipoId: team.id,
      estado: 'finalizada',
      numBots: 3,
      maxTurnos: 30,
      seed: null,
      sobresJson: null,
      resultadoJson: null,
      motivoAbort: null,
      createdAt: new Date(),
      finishedAt: new Date(),
    });

    await testDb.db.insert(agentMemories).values({
      gameId: gameId,
      teamId: team.id,
      memoryJson: '{"foo":"bar"}',
      updatedAt: new Date().toISOString(),
    });

    const response = await DELETE(
      new Request(`http://localhost/api/teams/${team.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: team.id }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deleted: false,
      archived: true,
      team: {
        id: team.id,
        estado: 'inactivo',
        hasMattinApiKey: false,
        miembros: [],
      },
    });

    const storedTeam = await testDb.db.select().from(equipos).where(eq(equipos.id, team.id)).get();
    expect(storedTeam).toMatchObject({
      id: team.id,
      estado: 'inactivo',
      descripcion: null,
      appId: null,
      mattinApiKey: null,
      miembros: '[]',
    });

    const gameLink = await testDb.db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.equipoId, team.id));
    expect(gameLink).toHaveLength(1);

    const trainingRows = await testDb.db
      .select()
      .from(partidasEntrenamiento)
      .where(eq(partidasEntrenamiento.equipoId, team.id));
    expect(trainingRows).toHaveLength(0);

    const memories = await testDb.db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.teamId, team.id));
    expect(memories).toHaveLength(0);
  });
});
