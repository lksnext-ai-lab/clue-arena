import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos, sobres, turnos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { CreateGameSchema } from '@/lib/schemas/game';
import { initGame } from '@/lib/game/engine';
import { v4 as uuidv4 } from 'uuid';

// GET /api/games
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');

  const allGames = await db.select().from(partidas).all();
  const filtered = estado ? allGames.filter((g) => g.estado === estado) : allGames;

  // Enrich with teams
  const enriched = await Promise.all(
    filtered.map(async (game) => {
      const gameTeams = await db
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, game.id))
        .all();

      return {
        ...game,
        equipos: gameTeams.map(({ pe, e }) => ({
          id: pe.id,
          equipoId: pe.equipoId,
          equipoNombre: e.nombre,
          orden: pe.orden,
          eliminado: pe.eliminado,
          puntos: pe.puntos,
        })),
      };
    })
  );

  return NextResponse.json({ games: enriched });
}

// POST /api/games
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

  const { nombre, equipoIds } = parsed.data;

  // Validate teams exist
  const teamRows = await Promise.all(
    equipoIds.map((id) =>
      db.select().from(equipos).where(eq(equipos.id, id)).get()
    )
  );
  if (teamRows.some((t) => !t)) {
    return NextResponse.json({ error: 'Uno o más equipos no existen' }, { status: 400 });
  }

  // Initialize game engine to get initial state (cards, envelope)
  const gameState = initGame(equipoIds);
  const gameId = uuidv4();

  // Persist game
  await db.insert(partidas).values({
    id: gameId,
    nombre,
    estado: 'pendiente',
    turnoActual: 0,
    createdAt: new Date(),
  });

  // Persist envelope (sobre secreto)
  await db.insert(sobres).values({
    id: uuidv4(),
    partidaId: gameId,
    sospechoso: gameState.sobre.sospechoso,
    arma: gameState.sobre.arma,
    habitacion: gameState.sobre.habitacion,
  });

  // Persist team assignments with cards
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

  const newGame = await db.select().from(partidas).where(eq(partidas.id, gameId)).get();
  return NextResponse.json(newGame, { status: 201 });
}
