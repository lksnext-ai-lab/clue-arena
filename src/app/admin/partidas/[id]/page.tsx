'use client';

import React from 'react';
import Image from 'next/image';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { apiFetch } from '@/lib/api/client';
import { useState } from 'react';
import { formatFecha } from '@/lib/utils/formatting';
import {
  PERSONAJE_META,
  ARMA_META,
  ESCENARIO_META,
  type Sospechoso,
  type Arma,
  type Habitacion,
} from '@/types/domain';
import { AgentLogPanel } from '@/components/admin/AgentLogPanel';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

/**
 * UI-008 — Detalle de partida (Admin)
 * Actualización en tiempo real via WebSocket.
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
    <GameProvider gameId={id}>
      <AdminPartidaContent gameId={id} />
    </GameProvider>
  );
}

// ---------------------------------------------------------------------------
// Main content (Client Component)
// ---------------------------------------------------------------------------

function AdminPartidaContent({ gameId }: { gameId: string }) {
  const { partida, isConnected, lastUpdated, refresh } = useGame();
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
      <main className="p-6 flex items-center justify-center text-slate-500">
        <p>Cargando partida...</p>
      </main>
    );
  }

  const { estado } = partida;
  const modo = partida.modoEjecucion as 'manual' | 'auto' | 'pausado' | undefined;

  const currentTurnoNumero =
    partida.turnos.find((t) => t.estado === 'en_curso')?.numero
    ?? partida.turnos.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-200">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{partida.nombre}</h1>
          <p className="text-sm mt-1 text-slate-500">
            Turno {currentTurnoNumero}{partida.maxTurnos ? ` / ${partida.maxTurnos}` : ''}
            {isConnected && ' · en tiempo real'}
            {lastUpdated && ` · ${formatFecha(lastUpdated)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GameStatusBadge estado={estado} />
          {estado === 'en_curso' && modo && (
            <Badge variant="secondary">{modo}</Badge>
          )}
        </div>
      </header>

      {/* ── Error banner ── */}
      {actionError && (
        <div
          className="px-4 py-3 rounded-md text-sm bg-red-900/40 text-red-300 border border-red-500/30"
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
        <h2 className="text-lg font-semibold mb-3 text-cyan-400">
          Equipos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {partida.equipos.map((equipo) => (
            <div
              key={equipo.equipoId}
              className={cn(
                'rounded-xl p-4 bg-slate-800 border',
                equipo.eliminado ? 'opacity-50 grayscale border-slate-700' : 'border-cyan-500/20'
              )}
            >
              <p className="font-medium text-sm">{equipo.equipoNombre}</p>
              <p className="text-xs mt-1 text-slate-500">
                Orden: {equipo.orden + 1} · {equipo.puntos} pts
              </p>
              {/* Admin sees cards */}
              {equipo.cartas && equipo.cartas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(equipo.cartas as string[]).map((carta) => (
                    <span
                      key={carta}
                      className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300"
                    >
                      {carta}
                    </span>
                  ))}
                </div>
              )}
              {equipo.eliminado && (
                <p className="text-xs mt-2 text-red-400">
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
          <h2 className="text-lg font-semibold mb-3 text-cyan-400">
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

      {/* ── F012: Agent interaction log (real-time, admin only) ── */}
      {estado !== 'pendiente' && (
        <AgentLogPanel gameId={gameId} />
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
            variant="secondary"
            loading={loading}
            onClick={() => onAction('start', { modo: 'manual' })}
          />
          <ActionButton
            label="Iniciar (auto)"
            variant="primary"
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
            variant="default"
            loading={loading}
            onClick={() => onAction('advance-turn')}
          />
          <ActionButton
            label="Activar auto-run"
            variant="primary"
            loading={loading}
            onClick={() => onAction('run', { turnoDelayMs: 3000 })}
          />
          <ActionButton
            label="Finalizar"
            variant="destructive"
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
            variant="warning"
            loading={loading}
            onClick={() => onAction('pause')}
          />
          <ActionButton
            label="Finalizar"
            variant="destructive"
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
            variant="primary"
            loading={loading}
            onClick={() => onAction('resume', { turnoDelayMs: 3000 })}
          />
          <ActionButton
            label="Avanzar turno"
            variant="default"
            loading={loading}
            onClick={() => onAction('advance-turn')}
          />
          <ActionButton
            label="Finalizar"
            variant="destructive"
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
  variant?: 'primary' | 'secondary' | 'destructive' | 'warning' | 'default';
  loading: boolean;
  onClick: () => void;
}

const actionButtonVariants = {
  primary: 'bg-cyan-500 text-slate-900 hover:bg-cyan-400',
  secondary: 'bg-emerald-500 text-slate-900 hover:bg-emerald-400',
  destructive: 'bg-red-500 text-white hover:bg-red-400',
  warning: 'bg-amber-500 text-slate-900 hover:bg-amber-400',
  default: 'bg-slate-700 text-slate-200 hover:bg-slate-600',
}

function ActionButton({ label, variant = 'default', loading, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 transition-opacity",
        actionButtonVariants[variant]
      )}
    >
      {loading ? '...' : label}
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
      className="rounded-xl p-4 text-sm bg-slate-800 border border-slate-700"
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
        <p key={s.id} className="text-xs mt-1 text-slate-400">
          💬 {s.sospechoso} · {s.arma} · {s.habitacion}
          {s.refutadaPor && ` → Refutada`}
          {s.cartaMostrada && (
            <span className="text-amber-400"> (carta: {s.cartaMostrada})</span>
          )}
        </p>
      ))}
      {turno.acusacion && (
        <p
          className={cn(
            "text-xs mt-2",
            turno.acusacion.correcta ? 'text-emerald-400' : 'text-red-400'
          )}
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
  const sospechosoMeta = PERSONAJE_META[sobre.sospechoso as Sospechoso];
  const armaMeta       = ARMA_META[sobre.arma as Arma];
  const habitacionMeta = ESCENARIO_META[sobre.habitacion as Habitacion];

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 text-cyan-400">
        🔍 Sobre secreto{!finalizada && <span className="text-xs ml-2 opacity-60">(solo admin)</span>}
      </h2>
      <div
        className="rounded-xl p-6 grid grid-cols-3 gap-6 bg-slate-800 border border-cyan-500/20"
      >
        <SobreCard
          label="Sospechoso"
          value={sobre.sospechoso}
          imagen={sospechosoMeta?.imagen}
          sublabel={sospechosoMeta?.departamento}
          accent={sospechosoMeta?.color ?? '#f59e0b'}
        />
        <SobreCard
          label="Arma"
          value={sobre.arma}
          imagen={armaMeta?.imagen}
          sublabel={armaMeta?.emoji}
          accent="#f59e0b"
        />
        <SobreCard
          label="Habitación"
          value={sobre.habitacion}
          imagen={habitacionMeta?.imagen}
          sublabel={habitacionMeta?.emoji}
          accent="#3b82f6"
        />
      </div>
    </section>
  );
}

interface SobreCardProps {
  label: string;
  value: string;
  imagen?: string;
  sublabel?: string;
  accent: string;
}

function SobreCard({ label, value, imagen, sublabel, accent }: SobreCardProps) {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col bg-slate-900/50"
      style={{ border: `2px solid ${accent}66`, boxShadow: `0 4px 24px ${accent}22` }}
    >
      {/* Imagen de la carta — aspect ratio de carta de juego (3:4) */}
      <div className="relative w-full" style={{ aspectRatio: '3/4', background: '#0a0a0f' }}>
        {imagen ? (
          <Image
            src={imagen}
            alt={value}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 30vw, 250px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">
            🃏
          </div>
        )}
      </div>
      {/* Pie de carta */}
      <div
        className="px-4 py-3 flex flex-col gap-0.5"
        style={{ borderTop: `1px solid ${accent}33` }}
      >
        <p className="text-[10px] uppercase tracking-widest font-medium text-slate-500">
          {label}
        </p>
        {sublabel && (
          <p className="text-xs font-medium" style={{ color: `${accent}bb` }}>
            {sublabel}
          </p>
        )}
        <p className="text-sm font-bold leading-snug" style={{ color: accent }}>
          {value}
        </p>
      </div>
    </div>
  );
}