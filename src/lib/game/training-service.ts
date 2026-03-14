import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { partidasEntrenamiento } from '@/lib/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/utils/errors';

export interface DeleteTrainingGameInput {
  gameId: string;
  teamId: string;
}

export interface DeleteTrainingGameResult {
  deleted: true;
  gameId: string;
}

/**
 * Deletes a finished or aborted training game belonging to the requesting team.
 * Active games must be aborted first to avoid removing an ongoing execution.
 */
export async function deleteTrainingGame({
  gameId,
  teamId,
}: DeleteTrainingGameInput): Promise<DeleteTrainingGameResult> {
  if (!gameId) {
    throw new ValidationError('gameId es obligatorio');
  }

  if (!teamId) {
    throw new ValidationError('teamId es obligatorio');
  }

  const row = await db
    .select({
      id: partidasEntrenamiento.id,
      estado: partidasEntrenamiento.estado,
    })
    .from(partidasEntrenamiento)
    .where(and(eq(partidasEntrenamiento.id, gameId), eq(partidasEntrenamiento.equipoId, teamId)))
    .get();

  if (!row) {
    throw new NotFoundError('Partida');
  }

  if (row.estado === 'en_curso') {
    throw new ConflictError('No se puede eliminar una partida en curso. Abórtala primero.');
  }

  await db.delete(partidasEntrenamiento).where(eq(partidasEntrenamiento.id, gameId));

  return {
    deleted: true,
    gameId,
  };
}
