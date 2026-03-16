'use client';

import { useTranslations } from 'next-intl';
import { useAppSession } from '@/contexts/SessionContext';
import { GameProvider, useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';
import { ArenaHeader } from './ArenaHeader';
import { ArenaTeamPanel } from './ArenaTeamPanel';
import { ArenaDeductionBoard } from './ArenaDeductionBoard';
import { ArenaActionFeed } from './ArenaActionFeed';
import { ArenaFinalResult } from './ArenaFinalResult';
import { SuggestionRevealOverlay } from './SuggestionRevealOverlay';
import { TurnActivityFeed } from './TurnActivityFeed';

interface ArenaViewProps {
  gameId: string;
  initialData: GameDetailResponse | null;
}

function PulseLine({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded bg-slate-700 animate-pulse`} />;
}

function ArenaSkeleton() {
  return (
    <div className="arena-shell space-y-3 p-3 lg:p-4">
      <div className="arena-panel p-4 space-y-2">
        <PulseLine h="h-6" w="w-56" />
        <PulseLine h="h-4" w="w-40" />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr_340px]">
        <div className="arena-panel p-3 space-y-2.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-700/60 p-3 space-y-2">
              <PulseLine h="h-4" w="w-28" />
              <PulseLine h="h-3" w="w-16" />
            </div>
          ))}
        </div>
        <div className="arena-panel p-3 space-y-2">
          {[...Array(7)].map((_, i) => (
            <PulseLine key={i} h="h-5" />
          ))}
        </div>
        <div className="arena-panel p-3 space-y-2">
          {[...Array(4)].map((_, i) => (
            <PulseLine key={i} h="h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ArenaError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useTranslations('arena.detail');
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="arena-panel max-w-sm w-full p-6 text-center space-y-2.5">
        <p className="text-red-300 font-semibold">{t('error.title')}</p>
        <p className="text-sm text-slate-400">{error.message}</p>
        <button
          onClick={onRetry}
          className="rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
        >
          {t('error.retry')}
        </button>
      </div>
    </div>
  );
}

function ArenaPending({ partida }: { partida: GameDetailResponse }) {
  const t = useTranslations('arena.detail');
  return (
    <div className="arena-shell space-y-3 p-3 lg:p-4">
      <div className="arena-panel arena-grid-glow overflow-hidden p-6 text-center">
        <div className="mx-auto max-w-2xl space-y-2">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.35em] text-amber-300/85">
            {t('pending.eyebrow')}
          </p>
          <p className="text-xl font-semibold text-white">{t('pending.title')}</p>
          <p className="text-xs text-slate-300 sm:text-sm">
            {t('pending.description')}
          </p>
        </div>
      </div>
      <ArenaTeamPanel partida={partida} />
    </div>
  );
}

export function ArenaView({ gameId, initialData }: ArenaViewProps) {
  return (
    <GameProvider gameId={gameId}>
      <ArenaContent initialData={initialData} gameId={gameId} />
    </GameProvider>
  );
}

function ArenaContent({ gameId: _gameId, initialData }: ArenaViewProps) {
  const { partida: live, isConnected, error, refresh } = useGame();
  const { rol } = useAppSession();

  const data = live ?? initialData;

  if (error && !data) return <ArenaError error={error} onRetry={refresh} />;
  if (!data) return <ArenaSkeleton />;

  const isAdmin = rol === 'admin';

  if (data.estado === 'pendiente') {
    return <ArenaPending partida={data} />;
  }

  const showLiveColumn = data.estado === 'en_curso';

  return (
    <div className="arena-shell space-y-3 p-3 lg:p-4">
      <ArenaHeader
        partida={data}
        isAdmin={isAdmin}
        isSyncing={isConnected}
        onRefresh={refresh}
      />

      {data.estado === 'finalizada' && <ArenaFinalResult partida={data} />}

      <section
        className={
          showLiveColumn
            ? 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,340px)]'
            : 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]'
        }
      >
        <ArenaTeamPanel partida={data} />
        <div className="relative min-w-0">
          <ArenaDeductionBoard partida={data} />
          {showLiveColumn && <SuggestionRevealOverlay partida={data} />}
        </div>
        {showLiveColumn && <TurnActivityFeed />}
      </section>

      <ArenaActionFeed partida={data} />
    </div>
  );
}
