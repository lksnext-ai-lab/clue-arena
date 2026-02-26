/**
 * Agent memory persistence — SQLite via Drizzle.
 * Server-side only. Never import this in client components.
 */
import { db } from '@/lib/db';
import { agentMemories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getAgentMemory(
  gameId: string,
  teamId: string
): Promise<Record<string, unknown>> {
  const row = await db
    .select()
    .from(agentMemories)
    .where(and(eq(agentMemories.gameId, gameId), eq(agentMemories.teamId, teamId)))
    .get();
  return row ? (JSON.parse(row.memoryJson) as Record<string, unknown>) : {};
}

export async function saveAgentMemory(
  gameId: string,
  teamId: string,
  memory: Record<string, unknown>
): Promise<void> {
  const memoryJson = JSON.stringify(memory);
  const updatedAt = new Date().toISOString();
  await db
    .insert(agentMemories)
    .values({ gameId, teamId, memoryJson, updatedAt })
    .onConflictDoUpdate({
      target: [agentMemories.gameId, agentMemories.teamId],
      set: { memoryJson, updatedAt },
    });
}
