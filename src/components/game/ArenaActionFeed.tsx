'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { GameDetailResponse } from '@/types/api';
import { ArenaActionItem } from './ArenaActionItem';

const PAGE_SIZE = 50;

interface ArenaActionFeedProps {
  partida: GameDetailResponse;
}

export function ArenaActionFeed({ partida }: ArenaActionFeedProps) {
  const t = useTranslations('arena.detail.actionFeed');
  const turnos = partida.turnos ?? [];
  const teamsMap: Record<string, string> = {};
  for (const e of partida.equipos) {
    teamsMap[e.equipoId] = e.equipoNombre;
  }

  const reversed = [...turnos].reverse();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reversed : reversed.slice(0, PAGE_SIZE);

  const prevLengthRef = useRef(reversed.length);
  const newCount = Math.max(0, reversed.length - prevLengthRef.current);

  useEffect(() => {
    prevLengthRef.current = reversed.length;
  });

  return (
    <section className="arena-panel flex flex-col gap-2.5 overflow-hidden p-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {t('eyebrow')}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-white">{t('title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-cyan-400/14 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
            {t('live')}
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300">
            {t('registeredTurns', { count: reversed.length })}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-600">{t('empty')}</p>
      ) : (
        <div className="arena-timeline-list flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1 scrollbar-panel">
          {visible.map((turno, idx) => (
            <ArenaActionItem
              key={turno.id}
              turno={turno}
              teams={teamsMap}
              isNew={idx < newCount}
            />
          ))}
        </div>
      )}

      {reversed.length > PAGE_SIZE && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-1 self-start text-[11px] text-cyan-300 transition-colors hover:text-cyan-200"
        >
          {t('showMore', { count: reversed.length - PAGE_SIZE })}
        </button>
      )}
    </section>
  );
}
