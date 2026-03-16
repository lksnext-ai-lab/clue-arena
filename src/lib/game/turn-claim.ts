import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const TURN_CLAIM_STALE_MS = 180_000;

let turnClaimColumnsSupported: boolean | null = null;
let missingTurnClaimColumnsWarned = false;

export interface TurnClaim {
  token: string;
  claimedAt: Date;
}

function hasTurnClaimColumns(): boolean {
  if (turnClaimColumnsSupported !== null) {
    return turnClaimColumnsSupported;
  }

  try {
    const rows = (
      db.$client
        .prepare('PRAGMA table_info(partidas)')
        .all() as Array<{ name?: unknown }>
    );
    const columnNames = new Set(
      rows
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string'),
    );

    turnClaimColumnsSupported =
      columnNames.has('turno_en_proceso_token') &&
      columnNames.has('turno_en_proceso_desde');
  } catch {
    turnClaimColumnsSupported = false;
  }

  if (!turnClaimColumnsSupported && !missingTurnClaimColumnsWarned) {
    missingTurnClaimColumnsWarned = true;
    console.warn(
      '> [concurrency] Las columnas de claim de turno no existen todavia en SQLite; ' +
        'la proteccion de concurrencia queda desactivada hasta aplicar migraciones.',
    );
  }

  return turnClaimColumnsSupported;
}

export async function claimTurnExecution(gameId: string): Promise<TurnClaim | null> {
  const token = uuidv4();
  const claimedAt = new Date();

  if (!hasTurnClaimColumns()) {
    return { token, claimedAt };
  }

  const result = db
    .update(partidas)
    .set({
      turnoEnProcesoToken: token,
      turnoEnProcesoDesde: claimedAt,
    })
    .where(
      and(
        eq(partidas.id, gameId),
        isNull(partidas.turnoEnProcesoToken),
      ),
    )
    .run();

  if (result.changes === 0) {
    return null;
  }

  return { token, claimedAt };
}

export async function releaseTurnExecution(gameId: string, token: string): Promise<void> {
  if (!hasTurnClaimColumns()) {
    return;
  }

  db
    .update(partidas)
    .set({
      turnoEnProcesoToken: null,
      turnoEnProcesoDesde: null,
    })
    .where(
      and(
        eq(partidas.id, gameId),
        eq(partidas.turnoEnProcesoToken, token),
      ),
    )
    .run();
}

export async function recoverStaleTurnClaims(): Promise<Array<{ id: string; nombre: string }>> {
  if (!hasTurnClaimColumns()) {
    return [];
  }

  const staleBefore = new Date(Date.now() - TURN_CLAIM_STALE_MS);

  const staleGames = db
    .select({ id: partidas.id, nombre: partidas.nombre })
    .from(partidas)
    .where(
      and(
        isNotNull(partidas.turnoEnProcesoToken),
        isNotNull(partidas.turnoEnProcesoDesde),
        lt(partidas.turnoEnProcesoDesde, staleBefore),
      ),
    )
    .all();

  if (staleGames.length === 0) {
    return [];
  }

  const ids = staleGames.map((g) => g.id);
  for (const id of ids) {
    db
      .update(partidas)
      .set({
        turnoEnProcesoToken: null,
        turnoEnProcesoDesde: null,
      })
      .where(eq(partidas.id, id))
      .run();
  }

  return staleGames;
}
