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

import { DELETE, PUT } from '@/app/api/admin/users/[id]/route';
import { equipos, usuarios } from '@/lib/db/schema';

async function insertUser(
  db: TestDb['db'],
  overrides: Partial<typeof usuarios.$inferInsert> = {},
) {
  const baseUser: typeof usuarios.$inferInsert = {
    id: uuidv4(),
    email: `${uuidv4()}@example.com`,
    nombre: 'Usuario de prueba',
    rol: 'espectador',
    createdAt: new Date(),
  };

  const user = { ...baseUser, ...overrides };
  await db.insert(usuarios).values(user);
  return user;
}

async function insertOwnedTeam(db: TestDb['db'], ownerId: string) {
  await db.insert(equipos).values({
    id: uuidv4(),
    nombre: `Equipo-${ownerId.slice(0, 6)}`,
    descripcion: null,
    agentId: `agent-${ownerId.slice(0, 6)}`,
    avatarUrl: null,
    miembros: '[]',
    usuarioId: ownerId,
    estado: 'activo',
    createdAt: new Date(),
  });
}

describe('admin user management route', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    testDbContainer.db = testDb.db;
    getAuthSessionMock.mockReset();
  });

  afterEach(() => {
    testDb.close();
    testDbContainer.db = null;
  });

  it('blocks admins from changing their own role', async () => {
    const admin = await insertUser(testDb.db, {
      email: 'admin@example.com',
      nombre: 'Admin',
      rol: 'admin',
    });

    getAuthSessionMock.mockResolvedValue({
      user: {
        id: admin.id,
        name: admin.nombre,
        email: admin.email,
        rol: 'admin',
        equipo: null,
      },
    });

    const response = await PUT(
      new Request(`http://localhost/api/admin/users/${admin.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rol: 'espectador' }),
      }),
      { params: Promise.resolve({ id: admin.id }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'SELF_ROLE_CHANGE' });
  });

  it('prevents deleting the last admin account', async () => {
    const admin = await insertUser(testDb.db, {
      email: 'last-admin@example.com',
      nombre: 'Ultimo admin',
      rol: 'admin',
    });

    getAuthSessionMock.mockResolvedValue({
      user: {
        id: 'operator-id',
        name: 'Operator',
        email: 'operator@example.com',
        rol: 'admin',
        equipo: null,
      },
    });

    const response = await DELETE(
      new Request(`http://localhost/api/admin/users/${admin.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: admin.id }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'ULTIMO_ADMIN' });
  });

  it('prevents deleting users who still own a team', async () => {
    const owner = await insertUser(testDb.db, {
      email: 'owner@example.com',
      nombre: 'Team Owner',
      rol: 'equipo',
    });
    await insertOwnedTeam(testDb.db, owner.id);

    getAuthSessionMock.mockResolvedValue({
      user: {
        id: 'admin-id',
        name: 'Admin',
        email: 'admin@example.com',
        rol: 'admin',
        equipo: null,
      },
    });

    const response = await DELETE(
      new Request(`http://localhost/api/admin/users/${owner.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: owner.id }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'USUARIO_CON_EQUIPO' });
  });

  it('updates another user role and returns the refreshed payload', async () => {
    const target = await insertUser(testDb.db, {
      email: 'spectator@example.com',
      nombre: 'Spectator',
      rol: 'espectador',
    });

    getAuthSessionMock.mockResolvedValue({
      user: {
        id: 'admin-id',
        name: 'Admin',
        email: 'admin@example.com',
        rol: 'admin',
        equipo: null,
      },
    });

    const response = await PUT(
      new Request(`http://localhost/api/admin/users/${target.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rol: 'equipo' }),
      }),
      { params: Promise.resolve({ id: target.id }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: target.id, rol: 'equipo' });
  });
});
