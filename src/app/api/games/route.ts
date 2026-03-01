import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos, sobres } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CreateGameSchema } from '@/lib/schemas/game';
import { initGame } from '@/lib/game/engine';
import { v4 as uuidv4 } from 'uuid';

// GET /api/games  (Admin: all games; Equipo: only their games)
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user || (session.user.rol !== 'admin' && session.user.rol !== 'equipo')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');

  const allGames = await db.select().from(partidas).all();
  const filtered = estado ? allGames.filter((g) => g.estado === estado) : allGames;

  const enriched = await Promise.all(
    filtered.map(async (game) => {
      const gameTeams = await db
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, game.id))
        .all();

      return {
        id: game.id,
        nombre: game.nombre,
        estado: game.estado,
        turnoActual: game.turnoActual,
        maxTurnos: game.maxTurnos ?? null,
        modoEjecucion: game.modoEjecucion,
        autoRunActivoDesde: game.autoRunActivoDesde?.toISOString() ?? null,
        createdAt: game.createdAt?.toISOString() ?? null,
        startedAt: game.startedAt?.toISOString() ?? null,
        finishedAt: game.finishedAt?.toISOString() ?? null,
        equipos: gameTeams.map(({ pe, e }) => ({
          id: pe.id,
          equipoId: pe.equipoId,
          equipoNombre: e.nombre,
          avatarUrl: e.avatarUrl ?? null,
          orden: pe.orden,
          eliminado: pe.eliminado,
          puntos: pe.puntos,
        })),
      };
    })
  );

  // Equipo role: only return games their team participates in
  const result =
    session.user.rol === 'equipo' && session.user.equipo
      ? enriched.filter((g) => g.equipos.some((e) => e.equipoId === session.user.equipo!.id))
      : enriched;

  return NextResponse.json({ games: result });
}

// POST /api/games  (Admin only)
export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = CreateGameSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { nombre, equipoIds, maxTurnos } = parsed.data;

  // Validate all teams exist
  const teamRows = await Promise.all(
    equipoIds.map((id) => db.select().from(equipos).where(eq(equipos.id, id)).get())
  );
  if (teamRows.some((t) => !t)) {
    return NextResponse.json(
      { error: 'EQUIPOS_INVALIDOS', message: 'Uno o más equipos no existen' },
      { status: 400 }
    );
  }

  // Warn (non-blocking) if any team is in an ongoing game
  const activeGames = await db
    .select()
    .from(partidas)
    .where(eq(partidas.estado, 'en_curso'))
    .all();
  const activeGameIds = activeGames.map((g) => g.id);
  const teamConflicts: string[] = [];
  if (activeGameIds.length > 0) {
    const activeAssignments = await Promise.all(
      activeGameIds.map((gid) =>
        db
          .select({ equipoId: partidaEquipos.equipoId })
          .from(partidaEquipos)
          .where(eq(partidaEquipos.partidaId, gid))
          .all()
      )
    );
    const activeEquipoIds = new Set(activeAssignments.flat().map((a) => a.equipoId));
    teamConflicts.push(...equipoIds.filter((id) => activeEquipoIds.has(id)));
  }

  // Initialize game state (pure: deals cards, creates envelope)
  const gameState = initGame(equipoIds);
  const gameId = uuidv4();
  const now = new Date();

  // Persist
  await db.insert(partidas).values({
    id: gameId,
    nombre,
    estado: 'pendiente',
    turnoActual: 0,
    maxTurnos: maxTurnos ?? null,
    createdAt: now,
  });

  await db.insert(sobres).values({
    id: uuidv4(),
    partidaId: gameId,
    sospechoso: gameState.sobre.sospechoso,
    arma: gameState.sobre.arma,
    habitacion: gameState.sobre.habitacion,
  });

  for (const equipoState of gameState.equipos) {
    await db.insert(partidaEquipos).values({
      id: uuidv4(),
      partidaId: gameId,
      equipoId: equipoState.equipoId,
      orden: equipoState.orden,
      eliminado: false,
      puntos: 0,
      cartas: JSON.stringify(equipoState.cartas),
    });
  }

  // Return typed GameResponse
  const insertedTeams = await db
    .select({ pe: partidaEquipos, e: equipos })
    .from(partidaEquipos)
    .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();

  return NextResponse.json(
    {
      id: gameId,
      nombre,
      estado: 'pendiente',
      turnoActual: 0,
      maxTurnos: maxTurnos ?? null,
      modoEjecucion: 'manual',
      autoRunActivoDesde: null,
      createdAt: now.toISOString(),
      startedAt: null,
      finishedAt: null,
      equipos: insertedTeams.map(({ pe, e }) => ({
        id: pe.id,
        equipoId: pe.equipoId,
        equipoNombre: e.nombre,
        orden: pe.orden,
        eliminado: pe.eliminado,
        puntos: pe.puntos,
      })),
      // Non-blocking advisory
      ...(teamConflicts.length > 0 ? { advertenciasEquipos: teamConflicts } : {}),
    },
    { status: 201 }
  );
}
