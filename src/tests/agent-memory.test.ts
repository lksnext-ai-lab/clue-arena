/**
 * Unit tests for agent memory persistence helpers.
 * Uses an in-memory SQLite test DB — no mocks needed for DB ops.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb } from './db';

// We need to inject our test DB into the module under test.
// Vitest hoists vi.mock calls, so we set up the factory before imports.
const testDbContainer: { db: ReturnType<typeof createTestDb>['db'] | null } = { db: null };

vi.mock('@/lib/db', () => ({
  get db() {
    return testDbContainer.db;
  },
}));

import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';

describe('getAgentMemory / saveAgentMemory', () => {
  let close: () => void;

  beforeEach(() => {
    const testDb = createTestDb();
    testDbContainer.db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => {
    close?.();
  });

  it('returns empty object when no memory exists', async () => {
    const result = await getAgentMemory('game-1', 'team-1');
    expect(result).toEqual({});
  });

  it('saves and retrieves memory correctly', async () => {
    const memory = { cards_seen: ['Mustard', 'Wrench'], confidence: 0.9 };
    await saveAgentMemory('game-1', 'team-1', memory);

    const retrieved = await getAgentMemory('game-1', 'team-1');
    expect(retrieved).toEqual(memory);
  });

  it('upserts memory on second call — no duplicate rows', async () => {
    const first = { cards_seen: ['Mustard'] };
    const second = { cards_seen: ['Mustard', 'Plum'], confidence: 0.7 };

    await saveAgentMemory('game-1', 'team-1', first);
    await saveAgentMemory('game-1', 'team-1', second);

    const retrieved = await getAgentMemory('game-1', 'team-1');
    expect(retrieved).toEqual(second);
  });

  it('keeps memories isolated per (gameId, teamId)', async () => {
    await saveAgentMemory('game-1', 'team-1', { note: 'team1' });
    await saveAgentMemory('game-1', 'team-2', { note: 'team2' });

    const t1 = await getAgentMemory('game-1', 'team-1');
    const t2 = await getAgentMemory('game-1', 'team-2');

    expect(t1).toEqual({ note: 'team1' });
    expect(t2).toEqual({ note: 'team2' });
  });
});
