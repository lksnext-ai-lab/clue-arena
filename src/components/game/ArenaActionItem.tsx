'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { TurnResponse } from '@/types/api';
import { SuggestionCardStrip } from './SuggestionRevealOverlay';

interface ArenaActionItemProps {
  turno: TurnResponse;
  isNew?: boolean;
  teams: Record<string, string>; // equipoId → nombre
}

export function ArenaActionItem({ turno, isNew, teams }: ArenaActionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSugerencias = turno.sugerencias.length > 0;
  const hasAcusacion = !!turno.acusacion;

  if (!hasSugerencias && !hasAcusacion) return null;

  const equipoNombre = turno.equipoNombre || teams[turno.equipoId] || turno.equipoId;

  return (
    <div
      className={cn(
        'rounded-xl border bg-slate-800/60 overflow-hidden transition-all',
        isNew && 'animate-in slide-in-from-top-2 duration-300',
        hasAcusacion && turno.acusacion?.correcta
          ? 'border-emerald-500/40'
          : hasAcusacion && !turno.acusacion?.correcta
            ? 'border-red-500/30'
            : 'border-slate-700/60'
      )}
    >
      {/* Sugerencias */}
      {turno.sugerencias.map((s) => {
        const refutadorNombre = s.refutadaPor ? (teams[s.refutadaPor] ?? s.refutadaPor) : null;
        return (
          <div key={s.id} className="p-3">
            <div
              className="flex items-start justify-between cursor-pointer select-none gap-2"
              onClick={() => setExpanded((v) => !v)}
            >
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-xs font-mono text-slate-500">T{turno.numero}</span>
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold bg-slate-700 text-slate-300">
                  SUGERENCIA
                </span>
                <span className="text-sm font-medium text-white">{equipoNombre}</span>
                {refutadorNombre ? (
                  <span className="shrink-0 text-xs text-amber-400">
                    ↩ {refutadorNombre}{s.cartaMostrada ? ` · ${s.cartaMostrada}` : ''}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-cyan-400">✓ nadie refutó</span>
                )}
              </div>
              <span className="text-slate-500 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div className="mt-2 pt-1">
                <SuggestionCardStrip
                  suggestion={s}
                  equipoNombre={equipoNombre}
                  refutadorNombre={refutadorNombre}
                  turnoNumero={turno.numero}
                  compact
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Acusación */}
      {turno.acusacion && (
        <div
          className={cn(
            'p-3',
            hasSugerencias && 'border-t border-slate-700/60',
            turno.acusacion.correcta ? 'bg-emerald-400/5' : 'bg-red-400/5'
          )}
        >
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-xs font-mono text-slate-500">T{turno.numero}</span>
              <span
                className={cn(
                  'shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold',
                  turno.acusacion.correcta
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-red-400/10 text-red-400'
                )}
              >
                ACUSACIÓN {turno.acusacion.correcta ? '✓' : '✗'}
              </span>
              <span className="text-sm font-medium text-white truncate">{equipoNombre}</span>
            </div>
            <span className="text-slate-500 text-xs ml-2 shrink-0">{expanded ? '▲' : '▼'}</span>
          </div>

          {expanded && (
            <div className="mt-2 pl-10 space-y-1 text-sm">
              <p className="text-slate-400">
                Sospechoso: <span className="text-slate-200">{turno.acusacion.sospechoso}</span>
              </p>
              <p className="text-slate-400">
                Arma: <span className="text-slate-200">{turno.acusacion.arma}</span>
              </p>
              <p className="text-slate-400">
                Habitación: <span className="text-slate-200">{turno.acusacion.habitacion}</span>
              </p>
              <p className="mt-1">
                {turno.acusacion.correcta ? (
                  <span className="text-emerald-400 font-semibold">
                    ¡CORRECTO! {equipoNombre} gana 🏆
                  </span>
                ) : (
                  <span className="text-red-400">
                    Incorrecto. {equipoNombre} eliminado.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* G004: spectator comments */}
      {(turno.agentSpectatorComment || turno.refutadorSpectatorComment) && (
        <div className="px-3 pb-2 pt-0 flex flex-col gap-0.5">
          {turno.agentSpectatorComment && (
            <p className="flex items-start gap-1.5 text-xs text-slate-400 italic">
              <span className="shrink-0 not-italic">💬</span>
              <span>&quot;{turno.agentSpectatorComment}&quot;</span>
            </p>
          )}
          {turno.refutadorSpectatorComment && (
            <p className="flex items-start gap-1.5 text-xs text-slate-500 italic">
              <span className="shrink-0 not-italic">↩💬</span>
              <span>&quot;{turno.refutadorSpectatorComment}&quot;</span>
            </p>
          )}
        </div>
      )}

      {/* Reasoning: shown when expanded */}
      {expanded && turno.agentReasoning && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/40">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            🧠 Razonamiento del agente
          </p>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
            {turno.agentReasoning}
          </p>
        </div>
      )}
    </div>
  );
}
