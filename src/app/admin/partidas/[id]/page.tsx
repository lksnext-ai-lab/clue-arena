'use client';

import { GameProvider, useGame } from '@/contexts/GameContext';
import { apiFetch } from '@/lib/api/client';
import { useState } from 'react';
import { formatFecha } from '@/lib/utils/formatting';

/**
 * UI-008 — Detalle de partida (Admin)
 * Polls every 3s.
 */
export default async function AdminPartidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <GameProvider gameId={id} pollingInterval={3_000}>
      <AdminPartidaContent gameId={id} />
    </GameProvider>
  );
}

function AdminPartidaContent({ gameId }: { gameId: string }) {
  const { partida, isPolling, lastUpdated, refresh } = useGame();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleStart = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/games/${gameId}/start`, { method: 'POST' });
      refresh();
    } catch (err: any) {
      setActionError(err?.message ?? 'Error al iniciar la partida');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/games/${gameId}/stop`, { method: 'POST' });
      refresh();
    } catch (err: any) {
      setActionError(err?.message ?? 'Error al detener la partida');
    } finally {
      setActionLoading(false);
    }
  };

  if (!partida) {
    return (
      <main className="p-6 flex items-center justify-center" style={{ color: '#64748b' }}>
        <p>Cargando partida...</p>
      </main>
    );
  }

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
            {isPolling && ' · actualizando cada 3s'}
            {lastUpdated && ` · ${formatFecha(lastUpdated)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: statusColors[partida.estado] + '22',
              color: statusColors[partida.estado],
            }}
          >
            {partida.estado}
          </span>
          {partida.estado === 'pendiente' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="px-4 py-1.5 rounded-md text-sm font-semibold disabled:opacity-50"
              style={{ background: '#22c55e', color: '#0a0a0f' }}
            >
              Iniciar
            </button>
          )}
          {partida.estado === 'en_curso' && (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="px-4 py-1.5 rounded-md text-sm font-semibold disabled:opacity-50"
              style={{ background: '#ef4444', color: '#fff' }}
            >
              Detener
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <div className="px-4 py-3 rounded-md text-sm" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
          {actionError}
        </div>
      )}

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
                Orden: {equipo.orden + 1} · {equipo.puntos} pts
              </p>
              {equipo.cartas && equipo.cartas.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  {equipo.cartas.length} cartas
                </p>
              )}
              {equipo.eliminado && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>❌ Eliminado</p>
              )}
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
            {[...partida.turnos].reverse().map((turno) => (
              <div
                key={turno.id}
                className="rounded-xl p-4 text-sm"
                style={{ background: '#1a1a2e' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">
                    Turno {turno.numero} — {turno.equipoNombre}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: '#334155', color: '#94a3b8' }}
                  >
                    {turno.estado}
                  </span>
                </div>
                {turno.sugerencias.map((s) => (
                  <p key={s.id} className="text-xs" style={{ color: '#94a3b8' }}>
                    💬 {s.sospechoso} · {s.arma} · {s.habitacion}
                    {s.refutadaPor && ` → Refutada`}
                    {s.cartaMostrada && ` (carta: ${s.cartaMostrada})`}
                  </p>
                ))}
                {turno.acusacion && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: turno.acusacion.correcta ? '#22c55e' : '#ef4444' }}
                  >
                    {turno.acusacion.correcta ? '✅' : '❌'} Acusación:{' '}
                    {turno.acusacion.sospechoso} · {turno.acusacion.arma} · {turno.acusacion.habitacion}
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
