'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  MessageSquareQuote,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { TurnResponse } from '@/types/api';
import { SuggestionCardStrip } from './SuggestionRevealOverlay';

interface ArenaActionItemProps {
  turno: TurnResponse;
  isNew?: boolean;
  teams: Record<string, string>;
}

type Tone = 'cyan' | 'emerald' | 'red' | 'amber' | 'slate';

function toneClasses(tone: Tone) {
  switch (tone) {
    case 'emerald':
      return {
        marker: 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.55)]',
        border: 'border-emerald-400/18',
        glow: 'from-emerald-400/10',
        badge: 'border-emerald-400/20 bg-emerald-400/12 text-emerald-200',
      };
    case 'red':
      return {
        marker: 'bg-red-300 shadow-[0_0_18px_rgba(252,165,165,0.55)]',
        border: 'border-red-400/18',
        glow: 'from-red-400/10',
        badge: 'border-red-400/20 bg-red-400/12 text-red-200',
      };
    case 'amber':
      return {
        marker: 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.55)]',
        border: 'border-amber-400/18',
        glow: 'from-amber-400/10',
        badge: 'border-amber-400/20 bg-amber-400/12 text-amber-200',
      };
    case 'slate':
      return {
        marker: 'bg-slate-400 shadow-[0_0_18px_rgba(148,163,184,0.35)]',
        border: 'border-white/8',
        glow: 'from-white/[0.06]',
        badge: 'border-white/10 bg-white/[0.06] text-slate-200',
      };
    default:
      return {
        marker: 'bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.55)]',
        border: 'border-cyan-400/18',
        glow: 'from-cyan-400/10',
        badge: 'border-cyan-400/20 bg-cyan-400/12 text-cyan-200',
      };
  }
}

function SuggestionSummaryText({
  suspect,
  weapon,
  room,
  highlightedCard,
}: {
  suspect: string;
  weapon: string;
  room: string;
  highlightedCard?: string | null;
}) {
  const items = [suspect, weapon, room];

  return (
    <span className="text-slate-200">
      {items.map((item, index) => (
        <span key={`${item}-${index}`}>
          <span
            className={cn(
              highlightedCard === item &&
                'rounded-md bg-amber-300/18 px-1 py-0.5 font-semibold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]'
            )}
          >
            {item}
          </span>
          {index < items.length - 1 && <span className="text-slate-500"> · </span>}
        </span>
      ))}
    </span>
  );
}

export function ArenaActionItem({ turno, isNew, teams }: ArenaActionItemProps) {
  const t = useTranslations('arena.detail.actionItem');
  const [expanded, setExpanded] = useState(false);
  const hasSugerencias = turno.sugerencias.length > 0;
  const hasAcusacion = !!turno.acusacion;
  const hasPase = !!turno.pase;
  const equipoNombre = turno.equipoNombre || teams[turno.equipoId] || turno.equipoId;
  const summary = useMemo(() => {
    if (turno.acusacion?.correcta) {
      return {
        Icon: Trophy,
        tone: 'emerald' as Tone,
        label: t('labels.victory'),
        detail: t('detail.caseSolvedBy', { teamName: equipoNombre }),
      };
    }
    if (turno.acusacion && !turno.acusacion.correcta) {
      return {
        Icon: ShieldAlert,
        tone: 'red' as Tone,
        label: t('labels.accusation'),
        detail: t('detail.teamEliminated', { teamName: equipoNombre }),
      };
    }
    if (turno.sugerencias.length > 0) {
      const lastSuggestion = turno.sugerencias.at(-1);
      return {
        Icon: Swords,
        tone: lastSuggestion?.refutadaPor ? 'amber' as Tone : 'cyan' as Tone,
        label: t('labels.suggestion'),
        detail: lastSuggestion?.refutadaPor
          ? t('detail.refutedBy', {
              teamName: teams[lastSuggestion.refutadaPor] ?? lastSuggestion.refutadaPor,
            })
          : t('detail.noRefutation'),
      };
    }
    return {
      Icon: SkipForward,
      tone: turno.pase?.origen === 'voluntario' ? 'slate' as Tone : 'amber' as Tone,
      label: t('labels.pass'),
      detail:
        turno.pase?.origen === 'timeout'
          ? t('detail.forcedTimeout')
          : turno.pase?.origen === 'invalid_format'
            ? t('detail.forcedInvalidFormat')
            : turno.pase?.origen === 'comm_error'
              ? t('detail.forcedCommError')
              : t('detail.voluntaryPass'),
    };
  }, [equipoNombre, t, teams, turno.acusacion, turno.pase, turno.sugerencias]);

  if (!hasSugerencias && !hasAcusacion && !hasPase) return null;

  const tone = toneClasses(summary.tone);

  return (
    <article className="arena-timeline-node relative pl-5 sm:pl-6">
      <span className={cn('arena-timeline-marker', tone.marker)} />

      <div
        className={cn(
          'relative overflow-hidden rounded-[1.1rem] border bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.82))] transition-all duration-300',
          tone.border,
          isNew && 'animate-in slide-in-from-top-2 fade-in duration-300'
        )}
      >
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent', tone.glow)} />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left sm:px-3.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-slate-300">
                T{turno.numero}
              </span>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]', tone.badge)}>
                <summary.Icon className="h-3 w-3" />
                {summary.label}
              </span>
              <span className="truncate text-[13px] font-semibold text-white">
                {equipoNombre}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span>{summary.detail}</span>
              {hasSugerencias && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-cyan-300" />
                  {t('plays', { count: turno.sugerencias.length })}
                </span>
              )}
              {turno.agentSpectatorComment && (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <MessageSquareQuote className="h-3 w-3 text-fuchsia-300" />
                  {t('liveComment')}
                </span>
              )}
            </div>
          </div>

          <span className="mt-0.5 rounded-full border border-white/10 bg-white/[0.05] p-1 text-slate-400">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        <div className="relative border-t border-white/6 px-3 pb-3 pt-2 sm:px-3.5">
          <div className="grid gap-2">
            {turno.sugerencias.map((s) => {
              const refutadorNombre = s.refutadaPor ? (teams[s.refutadaPor] ?? s.refutadaPor) : null;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.5))] px-2.5 py-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-1.5 py-0.5 font-semibold uppercase tracking-[0.16em] text-cyan-200">
                      {t('labels.suggestion')}
                    </span>
                    <SuggestionSummaryText
                      suspect={s.sospechoso}
                      weapon={s.arma}
                      room={s.habitacion}
                      highlightedCard={s.cartaMostrada}
                    />
                    <span className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
                      refutadorNombre ? 'bg-amber-400/12 text-amber-200' : 'bg-cyan-400/12 text-cyan-200'
                    )}>
                      {refutadorNombre ? `↩ ${refutadorNombre}` : t('detail.noRefutation')}
                    </span>
                  </div>

                  {expanded && (
                    <div className="mt-2">
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

            {turno.acusacion && (
              <div
                className={cn(
                  'rounded-xl border px-2.5 py-2',
                  turno.acusacion.correcta
                    ? 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.55))]'
                    : 'border-red-400/15 bg-[linear-gradient(180deg,rgba(248,113,113,0.12),rgba(15,23,42,0.55))]'
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.16em]',
                    turno.acusacion.correcta ? 'bg-emerald-400/12 text-emerald-200' : 'bg-red-400/12 text-red-200'
                  )}>
                    {t('labels.accusation')}
                  </span>
                  <span className="text-slate-200">
                    {turno.acusacion.sospechoso} · {turno.acusacion.arma} · {turno.acusacion.habitacion}
                  </span>
                  <span className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
                    turno.acusacion.correcta ? 'bg-emerald-400/12 text-emerald-200' : 'bg-red-400/12 text-red-200'
                  )}>
                    {turno.acusacion.correcta ? t('caseSolved') : t('eliminated')}
                  </span>
                </div>
              </div>
            )}

            {turno.pase && (
              <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {t('labels.pass')}
                  </span>
                  <span>{summary.detail}</span>
                </div>
              </div>
            )}

            {(turno.agentSpectatorComment || turno.refutadorSpectatorComment) && (
              <div className="rounded-xl border border-fuchsia-400/10 bg-[linear-gradient(180deg,rgba(192,132,252,0.1),rgba(15,23,42,0.48))] px-2.5 py-2">
                <div className="space-y-1">
                  {turno.agentSpectatorComment && (
                    <p className="flex items-start gap-1.5 text-[11px] italic text-slate-200">
                      <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-fuchsia-300" />
                      <span>&ldquo;{turno.agentSpectatorComment}&rdquo;</span>
                    </p>
                  )}
                  {turno.refutadorSpectatorComment && (
                    <p className="flex items-start gap-1.5 text-[11px] italic text-slate-400">
                      <Eye className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                      <span>&ldquo;{turno.refutadorSpectatorComment}&rdquo;</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {expanded && turno.agentReasoning && (
              <div className="rounded-xl border border-white/8 bg-slate-950/45 px-2.5 py-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('agentReasoning')}
                </p>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                  {turno.agentReasoning}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
