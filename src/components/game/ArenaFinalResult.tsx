'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { GameDetailResponse } from '@/types/api';

interface ArenaFinalResultProps {
  partida: GameDetailResponse;
}

const POSITION_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function ArenaFinalResult({ partida }: ArenaFinalResultProps) {
  const sorted = [...partida.equipos].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];

  return (
    <div className="rounded-xl border border-amber-500/30 bg-slate-800 p-6 space-y-5">
      {/* Trophy header */}
      <div className="text-center space-y-1">
        <p className="text-3xl">🏆</p>
        <h2 className="text-xl font-bold text-white">¡ PARTIDA FINALIZADA !</h2>
        {winner && (
          <p className="text-lg text-cyan-400 font-semibold">
            {winner.equipoNombre}{' '}
            <span className="text-slate-400 font-normal">— {winner.puntos} pts</span>
          </p>
        )}
      </div>

      {/* Envelope reveal */}
      {partida.sobre && (
        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-4 space-y-2 mx-auto max-w-sm">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider text-center">
            Sobre revelado
          </h3>
          <div className="space-y-1 text-sm">
            <p className="text-slate-400">
              Sospechoso:{' '}
              <span className="text-white font-medium">{partida.sobre.sospechoso}</span>
            </p>
            <p className="text-slate-400">
              Arma:{' '}
              <span className="text-white font-medium">{partida.sobre.arma}</span>
            </p>
            <p className="text-slate-400">
              Habitación:{' '}
              <span className="text-white font-medium">{partida.sobre.habitacion}</span>
            </p>
          </div>
        </div>
      )}

      {/* Final scoreboard */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Tabla final de puntuación
        </h3>
        <ol className="space-y-1.5">
          {sorted.map((e, idx) => (
            <li
              key={e.equipoId}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                idx === 0 ? 'bg-amber-500/10' : 'bg-slate-700/30'
              )}
            >
              <span className="flex items-center gap-2">
                <span>{POSITION_ICONS[idx + 1] ?? `${idx + 1}.`}</span>
                <span className={cn('font-medium', e.eliminado ? 'text-slate-500 line-through' : 'text-white')}>
                  {e.equipoNombre}
                </span>
                {e.eliminado && (
                  <span className="text-xs text-red-400">eliminado</span>
                )}
              </span>
              <span
                className={cn(
                  'font-bold',
                  e.puntos < 0 ? 'text-red-400' : idx === 0 ? 'text-amber-400' : 'text-slate-300'
                )}
              >
                {e.puntos} pts
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center">
        <Link
          href="/ranking"
          className="inline-block px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/30 transition-colors"
        >
          Ver Ranking Global →
        </Link>
      </div>
    </div>
  );
}
