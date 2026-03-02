/**
 * Server Component — Lists training games for the authenticated equipo.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { Badge } from '@/components/ui/badge';

async function getEquipoId(): Promise<string | null> {
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    const user = devRole ? DEV_USERS[devRole] : undefined;
    if (!user || user.rol !== 'equipo') return null;
    return user.equipo?.id ?? null;
  }
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as { rol?: string; equipo?: { id: string } };
  if (u.rol !== 'equipo') return null;
  return u.equipo?.id ?? null;
}

const BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  en_curso:   'default',
  finalizada: 'secondary',
  abortada:   'destructive',
};

const BADGE_LABEL: Record<string, string> = {
  en_curso:   'En curso',
  finalizada: 'Finalizada',
  abortada:   'Abortada',
};

export default async function EntrenamientoPage() {
  const equipoId = await getEquipoId();
  if (!equipoId) redirect('/login');

  const rows = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.equipoId, equipoId))
    .orderBy(desc(partidasEntrenamiento.createdAt))
    .limit(20)
    .all();

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [{ total: numTurnos }] = await db
        .select({ total: count() })
        .from(turnosEntrenamiento)
        .where(eq(turnosEntrenamiento.partidaId, row.id));
      const resultado = row.resultadoJson
        ? JSON.parse(row.resultadoJson) as { ganadorId: string | null; puntosSimulados: number }
        : null;
      return { ...row, numTurnos, resultado };
    }),
  );

  const activeGame = enriched.find((g) => g.estado === 'en_curso');

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Partidas de entrenamiento</h1>
        <Link
          href="/equipo/entrenamiento/nueva"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
        >
          + Iniciar entrenamiento
        </Link>
      </div>

      {/* Active game banner */}
      {activeGame && (
        <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 px-4 py-3">
          <p className="text-sm text-yellow-300">
            ⚡ Hay una partida en curso.{' '}
            <Link href={`/equipo/entrenamiento/${activeGame.id}`} className="underline font-semibold hover:text-yellow-100">
              Ver partida activa →
            </Link>
          </p>
        </div>
      )}

      {enriched.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-12 text-center space-y-3">
          <p className="text-slate-400">Aún no has jugado ninguna partida de entrenamiento.</p>
          <Link
            href="/equipo/entrenamiento/nueva"
            className="inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            Iniciar tu primera partida →
          </Link>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-slate-400">Fecha</th>
                <th className="px-3 py-2 text-left text-slate-400">Estado</th>
                <th className="px-3 py-2 text-center text-slate-400">Bots</th>
                <th className="px-3 py-2 text-center text-slate-400">Turnos</th>
                <th className="px-3 py-2 text-left text-slate-400">Resultado</th>
                <th className="px-3 py-2 text-left text-slate-400">Semilla</th>
                <th className="px-3 py-2 text-right text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900">
              {enriched.map((row) => {
                const ganadorLabel =
                  row.resultado?.ganadorId === equipoId
                    ? '🏆 Tu equipo'
                    : row.resultado?.ganadorId
                    ? `Bot ${row.resultado.ganadorId.replace('bot-', '')}`
                    : row.estado === 'abortada'
                    ? 'Abortada'
                    : '—';

                return (
                  <tr key={row.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={BADGE_VARIANT[row.estado] ?? 'outline'}>
                        {BADGE_LABEL[row.estado] ?? row.estado}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-300">{row.numBots}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{row.numTurnos}</td>
                    <td className="px-3 py-2 text-slate-300">{ganadorLabel}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs truncate max-w-[120px]">
                      {row.seed ? row.seed.slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/equipo/entrenamiento/${row.id}`}
                        className="text-indigo-400 hover:text-indigo-200 text-xs"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
