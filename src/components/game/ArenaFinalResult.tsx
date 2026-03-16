'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, ScrollText, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { GameDetailResponse } from '@/types/api';

interface ArenaFinalResultProps {
  partida: GameDetailResponse;
}

const POSITION_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function ArenaFinalResult({ partida }: ArenaFinalResultProps) {
  const t = useTranslations('arena.detail.finalResult');
  const sorted = [...partida.equipos].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];
  const winningTurn = partida.turnos.find(
    (t) => t.acusacion?.correcta === true && t.agentSpectatorComment,
  );

  return (
    <section className="arena-panel arena-grid-glow overflow-hidden p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-amber-300/16 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.88))] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                <Trophy className="h-3 w-3" />
                {t('status')}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {t('summary')}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t('champion')}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {winner?.equipoNombre ?? t('noWinner')}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {winner ? `${winner.puntos} pts` : t('noScore')}
                </p>
              </div>

              {partida.sobre && (
                <div className="rounded-[1rem] border border-amber-300/18 bg-slate-950/45 px-3 py-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                    <Eye className="h-3 w-3" />
                    {t('secretEnvelope')}
                  </div>
                  <div className="grid gap-1 text-[13px]">
                    <p className="text-slate-300">
                      <span className="text-slate-500">{t('suspect')}</span>{' '}
                      <span className="font-medium text-white">{partida.sobre.sospechoso}</span>
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">Arma</span>{' '}
                      <span className="font-medium text-white">{partida.sobre.arma}</span>
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">{t('room')}</span>{' '}
                      <span className="font-medium text-white">{partida.sobre.habitacion}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {winningTurn?.agentSpectatorComment && (
            <div className="rounded-[1.1rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(15,23,42,0.68))] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                <ScrollText className="h-3 w-3" />
                {t('caseResolution')}
              </div>
              <p className="mt-2 text-sm italic leading-relaxed text-slate-100">
                &ldquo;{winningTurn.agentSpectatorComment}&rdquo;
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {t('narratedBy', { teamName: winningTurn.equipoNombre })}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[1.15rem] border border-white/8 bg-slate-950/42 px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {t('ranking')}
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-white">{t('finalTable')}</h3>
            </div>
            <Link
              href="/ranking"
              className="rounded-full border border-cyan-400/16 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/18"
            >
              {t('globalRanking')}
            </Link>
          </div>

          <ol className="space-y-1.5">
            {sorted.map((e, idx) => (
              <li
                key={e.equipoId}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2 text-sm',
                  idx === 0
                    ? 'border-amber-300/16 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(15,23,42,0.72))]'
                    : 'border-white/8 bg-white/[0.04]'
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0">{POSITION_ICONS[idx + 1] ?? `${idx + 1}.`}</span>
                  <span className={cn('truncate font-medium', e.eliminado ? 'text-slate-500 line-through' : 'text-white')}>
                    {e.equipoNombre}
                  </span>
                  {e.eliminado && (
                    <span className="rounded-full bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-300">
                      {t('eliminated')}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-bold',
                    e.puntos < 0 ? 'text-red-300' : idx === 0 ? 'text-amber-200' : 'text-slate-200'
                  )}
                >
                  {e.puntos} pts
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
