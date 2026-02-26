'use client';

import { GameProvider, useGame } from '@/contexts/GameContext';
import { formatFecha } from '@/lib/utils/formatting';

/**
 * UI-005 — Vista de partida (espectador)
 * Public page. Polls every 5s while game is in progress.
 */
export default async function PartidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <GameProvider gameId={id} pollingInterval={5_000}>
      <PartidaContent />
    </GameProvider>
  );
}

function PartidaContent() {
  const { partida, isPolling, lastUpdated, error } = useGame();

  if (!partida && !error) {
    return (
      <div className="flex items-center justify-center p-6" style={{ color: '#64748b' }}>
        <p>Cargando partida...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p style={{ color: '#ef4444' }}>Error al cargar la partida</p>
          <p className="text-sm" style={{ color: '#64748b' }}>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!partida) return null;

  const statusColors: Record<string, string> = {
    pendiente: '#64748b',
    en_curso: '#22c55e',
    finalizada: '#f59e0b',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ color: '#f1f5f9' }}>
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{partida.nombre}</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Turno {partida.turnoActual}
            {isPolling && ' · actualizando...'}
            {lastUpdated && ` · ${formatFecha(lastUpdated)}`}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: statusColors[partida.estado] + '22', color: statusColors[partida.estado] }}
        >
          {partida.estado}
        </span>
      </header>

      {/* Teams */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#f59e0b' }}>
          Equipos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {partida.equipos.map((equipo) => (
            <div
              key={equipo.equipoId}
              className="rounded-xl p-4"
              style={{
                background: '#1a1a2e',
                opacity: equipo.eliminado ? 0.5 : 1,
                border: `1px solid ${equipo.eliminado ? '#334155' : '#f59e0b33'}`,
              }}
            >
              <p className="font-medium text-sm">{equipo.equipoNombre}</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                {equipo.eliminado ? '❌ Eliminado' : `${equipo.puntos} pts`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Turn history */}
      {partida.turnos && partida.turnos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: '#f59e0b' }}>
            Historial de turnos
          </h2>
          <div className="space-y-3">
            {partida.turnos.map((turno) => (
              <div
                key={turno.id}
                className="rounded-xl p-4 text-sm"
                style={{ background: '#1a1a2e' }}
              >
                <p className="font-medium">
                  Turno {turno.numero} — {turno.equipoNombre}
                </p>
                {turno.sugerencias.map((s) => (
                  <p key={s.id} className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                    💬 Sugiere: {s.sospechoso} con {s.arma} en {s.habitacion}
                    {s.refutadaPor && ` · Refutada por ${s.refutadaPor}`}
                  </p>
                ))}
                {turno.acusacion && (
                  <p className="text-xs mt-1" style={{ color: turno.acusacion.correcta ? '#22c55e' : '#ef4444' }}>
                    {turno.acusacion.correcta ? '✅ Acusación correcta' : '❌ Acusación incorrecta'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
