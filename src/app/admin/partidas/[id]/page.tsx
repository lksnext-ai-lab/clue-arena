'use client';

import React from 'react';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { apiFetch } from '@/lib/api/client';
import { useState } from 'react';
import { formatFecha } from '@/lib/utils/formatting';

/**
 * UI-008 — Detalle de partida (Admin)
 * Polls every 3s.
 *
 * ControlBar por estado × modoEjecucion:
 *   pendiente              → Iniciar (manual) · Iniciar (auto)
 *   en_curso / manual      → Avanzar turno · Activar auto-run · Finalizar
 *   en_curso / auto        → Pausar · Finalizar
 *   en_curso / pausado     → Reanudar · Avanzar turno · Finalizar
 *   finalizada             → solo lectura
 */
export default function AdminPartidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <GameProvider gameId={id} pollingInterval={3_000}>
      <AdminPartidaContent gameId={id} />
    </GameProvider>
  );
}

// ---------------------------------------------------------------------------
// Status / mode badges
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pendiente: '#64748b',
  en_curso: '#22c55e',
  finalizada: '#f59e0b',
};

const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  manual: { bg: '#33415522', text: '#94a3b8' },
  auto:   { bg: '#22c55e22', text: '#22c55e' },
  pausado: { bg: '#f59e0b22', text: '#f59e0b' },
};

// ---------------------------------------------------------------------------
// Main content (Client Component)
// ---------------------------------------------------------------------------

function AdminPartidaContent({ gameId }: { gameId: string }) {
  const { partida, isPolling, lastUpdated, refresh } = useGame();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function doAction(path: string, body?: object) {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/games/${gameId}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  if (!partida) {
    return (
      <main className="p-6 flex items-center justify-center" style={{ color: '#64748b' }}>
        <p>Cargando partida...</p>
      </main>
    );
  }

  const { estado } = partida;
  const modo = (partida as any).modoEjecucion as 'manual' | 'auto' | 'pausado' | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" style={{ color: '#f1f5f9' }}>
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{partida.nombre}</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Turno {partida.turnoActual}
            {isPolling && ' · actualizando cada 3 s'}
            {lastUpdated && ` · ${formatFecha(lastUpdated)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Estado badge */}
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: STATUS_COLORS[estado] + '22',
              color: STATUS_COLORS[estado],
            }}
          >
            {estado}
          </span>
          {/* modoEjecucion badge (solo cuando en curso) */}
          {estado === 'en_curso' && modo && (
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: MODE_COLORS[modo]?.bg ?? '#33415522',
                color: MODE_COLORS[modo]?.text ?? '#94a3b8',
              }}
            >
              {modo}
            </span>
          )}
        </div>
      </header>

      {/* ── Error banner ── */}
      {actionError && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: '#7f1d1d', color: '#fca5a5' }}
        >
          {actionError}
        </div>
      )}

      {/* ── ControlBar ── */}
      <ControlBar
        estado={estado}
        modo={modo}
        loading={actionLoading}
        onAction={doAction}
      />

      {/* ── Teams grid ── */}
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
              {/* Admin sees cards */}
              {equipo.cartas && equipo.cartas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(equipo.cartas as string[]).map((carta) => (
                    <span
                      key={carta}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: '#334155', color: '#94a3b8' }}
                    >
                      {carta}
                    </span>
                  ))}
                </div>
              )}
              {equipo.eliminado && (
                <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
                  ❌ Eliminado
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Turn history ── */}
      {partida.turnos && partida.turnos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: '#f59e0b' }}>
            Historial de turnos
          </h2>
          <div className="space-y-3">
            {[...partida.turnos].reverse().map((turno) => (
              <TurnoCard key={turno.id} turno={turno} />
            ))}
          </div>
        </section>
      )}

      {/* ── SobreReveal (admin always; others only on finalizada) ── */}
      {partida.sobre && (
        <SobreReveal sobre={partida.sobre} finalizada={estado === 'finalizada'} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ControlBar
// ---------------------------------------------------------------------------

interface ControlBarProps {
  estado: string;
  modo: 'manual' | 'auto' | 'pausado' | undefined;
  loading: boolean;
  onAction: (path: string, body?: object) => void;
}

function ControlBar({ estado, modo, loading, onAction }: ControlBarProps) {
  if (estado === 'finalizada') return null;

  return (
    <div className="flex flex-wrap gap-2">
      {/* ── pendiente ── */}
      {estado === 'pendiente' && (
        <>
          <ActionButton
            label="Iniciar (manual)"
            color="#22c55e"
            loading={loading}
            onClick={() => onAction('start', { modo: 'manual' })}
          />
          <ActionButton
            label="Iniciar (auto)"
            color="#3b82f6"
            loading={loading}
            onClick={() => onAction('start', { modo: 'auto', turnoDelayMs: 3000 })}
          />
        </>
      )}

      {/* ── en_curso / manual ── */}
      {estado === 'en_curso' && modo === 'manual' && (
        <>
          <ActionButton
            label="Avanzar turno"
            color="#6366f1"
            loading={loading}
            onClick={() => onAction('advance-turn')}
          />
          <ActionButton
            label="Activar auto-run"
            color="#3b82f6"
            loading={loading}
            onClick={() => onAction('run', { turnoDelayMs: 3000 })}
          />
          <ActionButton
            label="Finalizar"
            color="#ef4444"
            loading={loading}
            onClick={() => onAction('stop')}
          />
        </>
      )}

      {/* ── en_curso / auto ── */}
      {estado === 'en_curso' && modo === 'auto' && (
        <>
          <ActionButton
            label="Pausar"
            color="#f59e0b"
            loading={loading}
            onClick={() => onAction('pause')}
          />
          <ActionButton
            label="Finalizar"
            color="#ef4444"
            loading={loading}
            onClick={() => onAction('stop')}
          />
        </>
      )}

      {/* ── en_curso / pausado ── */}
      {estado === 'en_curso' && modo === 'pausado' && (
        <>
          <ActionButton
            label="Reanudar"
            color="#3b82f6"
            loading={loading}
            onClick={() => onAction('resume', { turnoDelayMs: 3000 })}
          />
          <ActionButton
            label="Avanzar turno"
            color="#6366f1"
            loading={loading}
            onClick={() => onAction('advance-turn')}
          />
          <ActionButton
            label="Finalizar"
            color="#ef4444"
            loading={loading}
            onClick={() => onAction('stop')}
          />
        </>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  color: string;
  loading: boolean;
  onClick: () => void;
}

function ActionButton({ label, color, loading, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 transition-opacity"
      style={{ background: color, color: color === '#f59e0b' ? '#0a0a0f' : '#fff' }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TurnoCard
// ---------------------------------------------------------------------------

function TurnoCard({ turno }: { turno: NonNullable<ReturnType<typeof useGame>['partida']>['turnos'][number] }) {
  const TURNO_STATUS_COLORS: Record<string, string> = {
    pendiente: '#64748b',
    en_curso: '#22c55e',
    completado: '#94a3b8',
    interrumpido: '#ef4444',
  };

  return (
    <div
      className="rounded-xl p-4 text-sm"
      style={{ background: '#1a1a2e' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium">
          Turno {turno.numero} — {turno.equipoNombre}
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: (TURNO_STATUS_COLORS[turno.estado] ?? '#64748b') + '22',
            color: TURNO_STATUS_COLORS[turno.estado] ?? '#64748b',
          }}
        >
          {turno.estado}
        </span>
      </div>
      {turno.sugerencias.map((s) => (
        <p key={s.id} className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          💬 {s.sospechoso} · {s.arma} · {s.habitacion}
          {s.refutadaPor && ` → Refutada`}
          {s.cartaMostrada && (
            <span style={{ color: '#f59e0b' }}> (carta: {s.cartaMostrada})</span>
          )}
        </p>
      ))}
      {turno.acusacion && (
        <p
          className="text-xs mt-2"
          style={{ color: turno.acusacion.correcta ? '#22c55e' : '#ef4444' }}
        >
          {turno.acusacion.correcta ? '✅' : '❌'} Acusación:{' '}
          {turno.acusacion.sospechoso} · {turno.acusacion.arma} · {turno.acusacion.habitacion}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SobreReveal
// ---------------------------------------------------------------------------

interface SobreRevealProps {
  sobre: { sospechoso: string; arma: string; habitacion: string };
  finalizada: boolean;
}

function SobreReveal({ sobre, finalizada }: SobreRevealProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3" style={{ color: '#f59e0b' }}>
        🔍 Sobre secreto{!finalizada && <span className="text-xs ml-2 opacity-60">(solo admin)</span>}
      </h2>
      <div
        className="rounded-xl p-5 flex gap-6"
        style={{ background: '#1a1a2e', border: '1px solid #f59e0b55' }}
      >
        <SobreItem label="Sospechoso" value={sobre.sospechoso} />
        <SobreItem label="Arma" value={sobre.arma} />
        <SobreItem label="Habitación" value={sobre.habitacion} />
      </div>
    </section>
  );
}

function SobreItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>
        {label}
      </p>
      <p className="font-semibold" style={{ color: '#f59e0b' }}>
        {value}
      </p>
    </div>
  );
}

