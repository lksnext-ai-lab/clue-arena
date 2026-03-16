'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { GiCardRandom } from 'react-icons/gi';
import { cn } from '@/lib/utils/cn';
import type { GameTeamResponse } from '@/types/api';
import type { PendingRequest } from './ArenaTeamPanel';
import { ScoreHistoryModal } from './ScoreHistoryModal';

interface ArenaTeamCardProps {
  gameId: string;
  equipo: GameTeamResponse;
  isActiveTurn: boolean;
  isLeader?: boolean;
  scoreMax?: number;
  pendingRequest?: PendingRequest;
}

function useElapsed(fromTs: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (fromTs === undefined) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - fromTs);
    const id = setInterval(() => setElapsed(Date.now() - fromTs), 100);
    return () => clearInterval(id);
  }, [fromTs]);
  return elapsed;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function usePrevValue(value: number): number {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

interface DeltaFlash {
  key: number;
  delta: number;
}

interface WarningFlash {
  key: number;
  warnings: number;
  isRed: boolean;
}

function FootballWarningCards({
  warnings,
  isEliminatedByWarnings,
  flashKey,
  t,
}: {
  warnings: number;
  isEliminatedByWarnings: boolean;
  flashKey?: number;
  t: ReturnType<typeof useTranslations>;
}) {
  if (warnings <= 0 && !isEliminatedByWarnings) return null;

  const showRed = isEliminatedByWarnings || warnings >= 3;
  const yellowCount = showRed ? 0 : Math.min(2, warnings);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1" title={showRed ? t('warning.redCardTitle') : t('warning.countTitle', { count: yellowCount })}>
        {Array.from({ length: yellowCount }).map((_, idx) => (
          <span
            key={`yellow-${idx}-${flashKey ?? 'base'}`}
            className={cn(
              'block h-4 w-3 rounded-[3px] border border-amber-100/35 bg-[linear-gradient(180deg,#fde047,#f59e0b)] shadow-[0_4px_12px_rgba(245,158,11,0.32)]',
              idx === yellowCount - 1 && flashKey ? 'animate-[warning-card-pop_620ms_ease-out]' : ''
            )}
            style={{ transform: `rotate(${idx % 2 === 0 ? -8 : 6}deg)` }}
          />
        ))}
        {showRed && (
          <span
            key={`red-${flashKey ?? 'base'}`}
            className={cn(
              'block h-4 w-3 rounded-[3px] border border-red-100/40 bg-[linear-gradient(180deg,#fb7185,#dc2626)] shadow-[0_4px_12px_rgba(239,68,68,0.36)]',
              flashKey ? 'animate-[warning-card-pop_620ms_ease-out]' : ''
            )}
            style={{ transform: 'rotate(-9deg)' }}
          />
        )}
      </div>
      <span className={cn(
        'text-[9px] font-semibold uppercase tracking-[0.16em]',
        showRed ? 'text-red-300' : 'text-amber-300'
      )}>
        {showRed ? t('warning.expelled') : `${warnings}/3`}
      </span>
    </div>
  );
}

export function ArenaTeamCard({
  gameId,
  equipo,
  isActiveTurn,
  isLeader = false,
  scoreMax,
  pendingRequest,
}: ArenaTeamCardProps) {
  const t = useTranslations('arena.detail.teamCard');
  const elapsed = useElapsed(pendingRequest?.fromTs);
  const prevPoints = usePrevValue(equipo.puntos);
  const prevWarnings = usePrevValue(equipo.warnings);
  const [flash, setFlash] = useState<DeltaFlash | null>(null);
  const [warningFlash, setWarningFlash] = useState<WarningFlash | null>(null);
  const flashKeyRef = useRef(0);
  const warningFlashKeyRef = useRef(0);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const diff = equipo.puntos - prevPoints;
    if (diff !== 0) {
      flashKeyRef.current += 1;
      setFlash({ key: flashKeyRef.current, delta: diff });
    }
  }, [equipo.puntos, prevPoints]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1700);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    if (equipo.warnings <= prevWarnings) return;
    warningFlashKeyRef.current += 1;
    setWarningFlash({
      key: warningFlashKeyRef.current,
      warnings: equipo.warnings,
      isRed: equipo.eliminadoPorWarnings || equipo.warnings >= 3,
    });
  }, [equipo.warnings, equipo.eliminadoPorWarnings, prevWarnings]);

  useEffect(() => {
    if (!warningFlash) return;
    const id = setTimeout(() => setWarningFlash(null), 1600);
    return () => clearTimeout(id);
  }, [warningFlash]);

  const openHistory = useCallback(() => setShowHistory(true), []);
  const closeHistory = useCallback(() => setShowHistory(false), []);

  const requestLabel = pendingRequest?.type === 'turno'
    ? t('request.turn')
    : t('request.refutation');
  const resolvedScoreMax = Math.max(1, scoreMax ?? Math.max(100, equipo.puntos, 1));
  const scoreWidth = Math.max(0, Math.min(100, (Math.max(0, equipo.puntos) / resolvedScoreMax) * 100));
  const statusTone = equipo.eliminado
    ? 'border-red-400/20 bg-red-400/10 text-red-200'
    : isActiveTurn
      ? 'border-cyan-300/40 bg-cyan-400/14 text-cyan-100'
      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';

  return (
    <>
      <div
        className={cn(
          'group relative rounded-[1.2rem] border bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.72))] p-3 transition-all duration-500',
          equipo.eliminado
            ? 'border-slate-700/50 opacity-40 grayscale'
            : isActiveTurn
              ? 'border-cyan-300/30 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_24px_60px_rgba(14,165,233,0.18)]'
              : 'border-white/8 hover:border-white/15'
        )}
      >
        {isLeader && !equipo.eliminado && (
          <div className="pointer-events-none absolute -right-1 top-0 z-20 -translate-y-1/2 rotate-[22deg] select-none text-lg drop-shadow-[0_8px_14px_rgba(251,191,36,0.35)]">
            👑
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg',
                isActiveTurn && !equipo.eliminado
                  ? 'ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.35)]'
                  : 'ring-1 ring-white/10'
              )}
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}
            >
              {equipo.avatarUrl
                ? <img src={equipo.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>🛡️</span>}
              {!equipo.eliminado && (
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-900',
                    isActiveTurn ? 'bg-cyan-300 animate-pulse' : 'bg-emerald-300'
                  )}
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/8 bg-white/6 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  #{equipo.orden + 1}
                </span>
                <span className="break-words text-[13px] font-semibold leading-snug text-white">{equipo.equipoNombre}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <FootballWarningCards
                  warnings={equipo.warnings}
                  isEliminatedByWarnings={Boolean(equipo.eliminadoPorWarnings)}
                  flashKey={warningFlash?.key}
                  t={t}
                />
              </div>
              {isActiveTurn && !equipo.eliminado && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 animate-pulse">
                  <span className="h-1 w-1 rounded-full bg-cyan-400" />
                  {t('activeTurn')}
                </span>
              )}
            </div>
          </div>

          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]', statusTone)}>
            {equipo.eliminado ? t('status.eliminated') : isActiveTurn ? t('status.focus') : t('status.active')}
          </span>
        </div>

        <div className="mt-3 grid gap-1.5 rounded-xl border border-white/8 bg-slate-950/55 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openHistory}
              title={t('scoreHistory')}
              className={cn(
                'relative flex min-w-0 cursor-pointer items-end gap-2 rounded-lg transition-colors select-none',
                'hover:text-white active:opacity-90'
              )}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                {t('score')}
              </span>
              <span className="text-sm font-bold text-cyan-300">{equipo.puntos} pts</span>
              {flash && (
                <span
                  key={flash.key}
                  className={cn(
                    'animate-score-delta left-14 top-0',
                    flash.delta > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {flash.delta > 0 ? `+${flash.delta}` : flash.delta}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100 shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
              <GiCardRandom className="h-4 w-4 text-amber-200" aria-hidden="true" />
              <span className="font-semibold">{equipo.numCartas}</span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400">
              <span />
              <span>{equipo.puntos} / {resolvedScoreMax}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.85),rgba(168,85,247,0.7))]"
                style={{ width: `${scoreWidth}%` }}
              />
            </div>
          </div>
        </div>

        {pendingRequest && !equipo.eliminado && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <span className="flex-1 text-[11px] leading-tight text-amber-300">{requestLabel}</span>
            <span className="shrink-0 font-mono text-[11px] text-amber-400/80">{formatMs(elapsed)}</span>
          </div>
        )}

        {warningFlash && (
          <div
            key={warningFlash.key}
            className={cn(
              'mt-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium animate-in fade-in slide-in-from-bottom-2 duration-300',
              warningFlash.isRed
                ? 'border-red-400/25 bg-red-400/10 text-red-200'
                : 'border-amber-300/25 bg-amber-300/10 text-amber-200'
            )}
          >
            {warningFlash.isRed
              ? t('warning.redCardTitle')
              : t('warning.received', { count: warningFlash.warnings })}
          </div>
        )}
      </div>

      {showHistory && (
        <ScoreHistoryModal
          gameId={gameId}
          equipoId={equipo.equipoId}
          equipoNombre={equipo.equipoNombre}
          currentPoints={equipo.puntos}
          onClose={closeHistory}
        />
      )}
    </>
  );
}
