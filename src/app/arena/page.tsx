import Link from 'next/link';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import type { GameStatus } from '@/types/domain';

/**
 * /arena — Gateway hacia las vistas de espectador.
 * Lista las partidas en curso y las últimas finalizadas.
 * Cualquier usuario autenticado puede acceder (el layout protege la ruta).
 */
export default async function ArenaGatewayPage() {
  const allGames = await db
    .select()
    .from(partidas)
    .orderBy(desc(partidas.createdAt))
    .all();

  // Enrich with team count
  const enriched = await Promise.all(
    allGames.map(async (g) => {
      const teamRows = await db
        .select({ nombre: equipos.nombre })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, g.id))
        .all();
      return { ...g, equipoNombres: teamRows.map((t) => t.nombre) };
    })
  );

  const enCurso = enriched.filter((g) => g.estado === 'en_curso');
  const finalizadas = enriched.filter((g) => g.estado === 'finalizada').slice(0, 5);
  const pendientes = enriched.filter((g) => g.estado === 'pendiente');

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Arena</h1>
      <p className="text-slate-400 text-sm">
        Sigue las partidas en tiempo real como espectador.
      </p>

      {/* En curso */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          En curso
        </h2>
        {enCurso.length === 0 ? (
          <p className="text-slate-600 text-sm">No hay ninguna partida en curso ahora mismo.</p>
        ) : (
          enCurso.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              nombre={g.nombre}
              estado={g.estado as GameStatus}
              turnoActual={g.turnoActual}
              equipoNombres={g.equipoNombres}
              highlight
            />
          ))
        )}
      </section>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pendientes de inicio
          </h2>
          {pendientes.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              nombre={g.nombre}
              estado={g.estado as GameStatus}
              turnoActual={g.turnoActual}
              equipoNombres={g.equipoNombres}
            />
          ))}
        </section>
      )}

      {/* Finalizadas recientes */}
      {finalizadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Finalizadas recientes
          </h2>
          {finalizadas.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              nombre={g.nombre}
              estado={g.estado as GameStatus}
              turnoActual={g.turnoActual}
              equipoNombres={g.equipoNombres}
            />
          ))}
        </section>
      )}

      {allGames.length === 0 && (
        <p className="text-slate-600 text-sm">No hay partidas todavía.</p>
      )}
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

interface GameCardProps {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  equipoNombres: string[];
  highlight?: boolean;
}

function GameCard({ id, nombre, estado, turnoActual, equipoNombres, highlight }: GameCardProps) {
  return (
    <Link
      href={`/partidas/${id}`}
      className={
        highlight
          ? 'block rounded-xl border border-cyan-500/30 bg-slate-800 p-4 hover:bg-slate-700/80 transition-colors group'
          : 'block rounded-xl border border-slate-700 bg-slate-800 p-4 hover:bg-slate-700/80 transition-colors group'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
            {nombre}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Turno {turnoActual}
            {equipoNombres.length > 0 && (
              <> · {equipoNombres.join(', ')}</>
            )}
          </p>
        </div>
        <GameStatusBadge estado={estado} />
      </div>
    </Link>
  );
}
