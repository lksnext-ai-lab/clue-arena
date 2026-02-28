import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { equipos, partidaEquipos, partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/ranking
export async function GET() {
  const allTeams = await db.select().from(equipos).all();

  // Aggregate points across all finished games
  const rankingData = await Promise.all(
    allTeams.map(async (team) => {
      const gameRows = await db
        .select()
        .from(partidaEquipos)
        .where(eq(partidaEquipos.equipoId, team.id))
        .all();

      // Only count finished games
      const finishedGameIds = db
        .select()
        .from(partidas)
        .where(eq(partidas.estado, 'finalizada'))
        .all()
        .map((g) => g.id);

      const finishedGameRows = gameRows.filter((r) => finishedGameIds.includes(r.partidaId));

      const totalPuntos = finishedGameRows.reduce((sum, r) => sum + r.puntos, 0);
      const aciertos = finishedGameRows.filter((r) => r.puntos > 0 && !r.eliminado).length;

      return {
        equipoId: team.id,
        equipoNombre: team.nombre,
        avatarUrl: team.avatarUrl ?? null,
        puntos: totalPuntos,
        partidasJugadas: finishedGameRows.length,
        aciertos,
      };
    })
  );

  // Sort by puntos descending, assign positions
  rankingData.sort((a, b) => b.puntos - a.puntos);
  const ranked = rankingData.map((entry, idx) => ({
    id: `${entry.equipoId}-ranking`,
    ...entry,
    posicion: idx + 1,
  }));

  return NextResponse.json({
    ranking: ranked,
    updatedAt: new Date().toISOString(),
  });
}
