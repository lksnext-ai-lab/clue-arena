'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import type { GameDetailResponse, SuggestionResponse, TurnResponse } from '@/types/api';
import { PERSONAJE_META, ARMA_META, ESCENARIO_META } from '@/types/domain';

// ── Types ─────────────────────────────────────────────────────────────────────

type AnimPhase = 'entering' | 'pending' | 'refuted' | 'no_refutation' | 'dissolving';

interface ActiveAnim {
  suggestion: SuggestionResponse;
  turnoNumero: number;
  equipoNombre: string;
  refutadorNombre: string | null;
  phase: AnimPhase;
}

/**
 * Overlay rendered inside a `relative` wrapper around the deduction board.
 * Covers the entire board while a suggestion is in progress, then dissolves.
 */
export interface SuggestionRevealOverlayProps {
  partida: GameDetailResponse;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLatestSuggestionWithTurn(
  partida: GameDetailResponse
): { sug: SuggestionResponse; turno: TurnResponse; equipoNombre: string } | null {
  if (!partida.turnos?.length) return null;
  const sorted = [...partida.turnos].sort((a, b) => b.numero - a.numero);
  for (const turno of sorted) {
    const sugs = turno.sugerencias;
    if (sugs.length > 0) {
      return {
        sug: sugs[sugs.length - 1],
        turno,
        equipoNombre: turno.equipoNombre || turno.equipoId,
      };
    }
  }
  return null;
}

// ── Suggestion card ───────────────────────────────────────────────────────────

interface CardData {
  type: 'Sospechoso' | 'Arma' | 'Habitación';
  value: string;
  imagen: string;
  emoji: string;
  accentColor: string;
}

function buildCards(sug: SuggestionResponse): CardData[] {
  const personajeMeta = (PERSONAJE_META as Record<string, { color: string; imagen: string } | undefined>)[sug.sospechoso];
  const armaMeta      = (ARMA_META      as Record<string, { emoji: string; imagen: string } | undefined>)[sug.arma];
  const escenarioMeta = (ESCENARIO_META as Record<string, { emoji: string; imagen: string } | undefined>)[sug.habitacion];

  return [
    {
      type: 'Sospechoso',
      value: sug.sospechoso,
      imagen: personajeMeta?.imagen ?? '',
      emoji: '🕵️',
      accentColor: personajeMeta?.color ?? '#94a3b8',
    },
    {
      type: 'Arma',
      value: sug.arma,
      imagen: armaMeta?.imagen ?? '',
      emoji: armaMeta?.emoji ?? '🔧',
      accentColor: '#f59e0b',
    },
    {
      type: 'Habitación',
      value: sug.habitacion,
      imagen: escenarioMeta?.imagen ?? '',
      emoji: escenarioMeta?.emoji ?? '🏢',
      accentColor: '#3b82f6',
    },
  ];
}

// Stagger delays in milliseconds for the entering animation
const STAGGER_DELAYS = [0, 160, 320] as const;

// ── SuggestionCardStrip (exported, reusable) ──────────────────────────────────

export interface SuggestionCardStripProps {
  suggestion: SuggestionResponse;
  equipoNombre: string;
  refutadorNombre: string | null;
  turnoNumero: number;
  /**
   * compact=true: smaller image height, no enter animation.
   * Used inline in the action feed as a static summary.
   */
  compact?: boolean;
  phase?: 'entering' | 'pending' | 'refuted' | 'no_refutation';
}

export function SuggestionCardStrip({
  suggestion: sug,
  equipoNombre,
  refutadorNombre,
  turnoNumero,
  compact = false,
  phase: phaseProp,
}: SuggestionCardStripProps) {
  const phase: 'refuted' | 'no_refutation' | 'pending' =
    phaseProp === 'refuted' || sug.refutadaPor
      ? 'refuted'
      : phaseProp === 'no_refutation'
        ? 'no_refutation'
        : 'pending';

  const isRefuted        = phase === 'refuted';
  const isNoRef          = phase === 'no_refutation';
  const highlightedValue = isRefuted && sug.cartaMostrada ? sug.cartaMostrada : null;
  const cards            = buildCards(sug);
  const imageH           = 'h-28';

  return (
    <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-3')}>

      {/* Header row — hidden in compact mode (feed row already shows team/turn) */}
      {!compact && (
      <div className={cn(
        'flex items-center gap-2 min-w-0 rounded-lg px-3 py-1.5',
        'bg-slate-900/80 backdrop-blur-[2px]'
      )}>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">
          T{turnoNumero} · Sugerencia
        </span>
        <span className="text-sm font-semibold text-slate-200 truncate">
          {equipoNombre}
        </span>
        {isRefuted && refutadorNombre && (
          <span className="ml-auto shrink-0 text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <span className="text-amber-400">↩</span>
            {refutadorNombre}
          </span>
        )}
        {isNoRef && (
          <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-400">
            ✓ Nadie refutó
          </span>
        )}
        {phase === 'pending' && (
          <span className="ml-auto flex items-center gap-1 shrink-0">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
        )}
      </div>
      )}

      {/* Cards */}
      <div className={cn(
        compact
          ? 'flex flex-row gap-2 overflow-x-auto pb-1'
          : 'grid grid-cols-3 gap-3 w-full'
      )}>
        {cards.map((card, idx) => {
          const isHighlighted    = isRefuted && highlightedValue === card.value;
          const isRefutedGeneric = isRefuted && !sug.cartaMostrada;

          return (
            <div
              key={card.type}
              className={cn(
                'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-500',
                compact ? 'w-24 shrink-0' : '',
                !compact && phaseProp === 'entering' ? 'animate-in slide-in-from-bottom-6 fade-in' : '',
                isHighlighted
                  ? 'border-amber-400/80 scale-105 shadow-[0_0_24px_rgba(251,191,36,0.45)] z-10'
                  : isRefuted && !isRefutedGeneric
                    ? 'border-slate-700/40 opacity-50'
                    : isRefutedGeneric
                      ? 'border-amber-500/30'
                      : isNoRef
                        ? 'border-emerald-500/30'
                        : 'border-slate-700/50'
              )}
              style={{
                animationDelay: !compact ? `${STAGGER_DELAYS[idx]}ms` : undefined,
                animationDuration: !compact ? '450ms' : undefined,
              }}
            >
              {isHighlighted && refutadorNombre && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 shadow-lg z-20">
                  {refutadorNombre}
                </div>
              )}

              <div className={cn('relative w-full bg-slate-900/80 overflow-hidden', imageH)}>
                {card.imagen ? (
                  <Image
                    src={card.imagen}
                    alt={card.value}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-3xl">
                    {card.emoji}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-900/95 to-transparent" />
              </div>

              <div
                className={cn('bg-slate-900/95 text-center', compact ? 'px-1.5 py-1.5' : 'px-2 py-2')}
                style={{ borderTop: `2px solid ${card.accentColor}60` }}
              >
                <span
                  className="block font-bold uppercase tracking-widest mb-0.5"
                  style={{ fontSize: compact ? '8px' : '9px', color: card.accentColor }}
                >
                  {card.type}
                </span>
                <span className={cn(
                  'block font-semibold leading-tight',
                  compact ? 'text-[10px]' : 'text-[11px]',
                  isHighlighted ? 'text-amber-200' : 'text-slate-200'
                )}>
                  {card.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isRefuted && refutadorNombre && !sug.cartaMostrada && (
        <div className={cn(
          'w-full rounded-lg border border-amber-400/25 bg-amber-400/10 text-center',
          compact ? 'px-2 py-1.5' : 'px-4 py-2.5',
          !compact && 'animate-in fade-in duration-500'
        )}>
          <p className="text-xs text-amber-300/90 font-medium">
            <span className="mr-1 text-amber-400">↩</span>
            <span className="font-semibold">{refutadorNombre}</span>
            {' '}mostró una carta (contenido oculto)
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SuggestionRevealOverlay({ partida }: SuggestionRevealOverlayProps) {
  const [anim, setAnim] = useState<ActiveAnim | null>(null);

  // Suggestions whose animation has fully completed — never show again
  const shownSugIdsRef    = useRef<Set<string>>(new Set());
  const animSugIdRef      = useRef<string | null>(null);
  const animTurnoNumRef   = useRef<number | null>(null);
  const animRefutadaRef   = useRef<string | null>(null);
  const enterTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dissolveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build team name lookup
  const teamsMap: Record<string, string> = {};
  for (const e of partida.equipos) {
    teamsMap[e.equipoId] = e.equipoNombre;
  }

  // ── Helpers ──

  const clearAllTimers = useCallback(() => {
    if (enterTimerRef.current)   { clearTimeout(enterTimerRef.current);   enterTimerRef.current   = null; }
    if (dissolveTimerRef.current) { clearTimeout(dissolveTimerRef.current); dissolveTimerRef.current = null; }
  }, []);

  /** Schedule: refuted/no_refutation → dissolving → null */
  const scheduleDissolve = useCallback((sugId: string, delayMs = 5_000) => {
    if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current);
    dissolveTimerRef.current = setTimeout(() => {
      setAnim((prev) => prev ? { ...prev, phase: 'dissolving' } : null);
      dissolveTimerRef.current = setTimeout(() => {
        // Mark as seen so this suggestion is never re-triggered by future polls
        shownSugIdsRef.current.add(sugId);
        setAnim(null);
        animSugIdRef.current    = null;
        animTurnoNumRef.current = null;
        animRefutadaRef.current = null;
      }, 800);
    }, delayMs);
  }, []);

  // ── Core effect: reacts to every polling update ──

  useEffect(() => {
    if (partida.estado !== 'en_curso') return;

    const latest = getLatestSuggestionWithTurn(partida);
    if (!latest) return;

    const { sug, turno, equipoNombre } = latest;
    const refutadorNombre = sug.refutadaPor
      ? (teamsMap[sug.refutadaPor] ?? sug.refutadaPor)
      : null;

    // ── Already shown: skip no matter what ──
    if (shownSugIdsRef.current.has(sug.id)) return;

    // ── Case A: brand-new suggestion (not yet animating) ──
    if (sug.id !== animSugIdRef.current) {
      clearAllTimers();
      animSugIdRef.current    = sug.id;
      animTurnoNumRef.current = turno.numero;
      animRefutadaRef.current = sug.refutadaPor;

      if (sug.refutadaPor) {
        // Already refuted by the time we first see it
        setAnim({ suggestion: sug, turnoNumero: turno.numero, equipoNombre, refutadorNombre, phase: 'refuted' });
        scheduleDissolve(sug.id, 5_000);
      } else {
        // Animate entering → pending, waiting for refutation
        setAnim({ suggestion: sug, turnoNumero: turno.numero, equipoNombre, refutadorNombre, phase: 'entering' });
        enterTimerRef.current = setTimeout(() => {
          setAnim((prev) =>
            prev?.suggestion.id === sug.id ? { ...prev, phase: 'pending' } : prev
          );
        }, 900);
      }
      return;
    }

    // ── Case B: same suggestion, now refuted ──
    if (sug.refutadaPor !== null && animRefutadaRef.current === null) {
      animRefutadaRef.current = sug.refutadaPor;
      setAnim((prev) =>
        prev?.suggestion.id === sug.id
          ? { ...prev, suggestion: sug, refutadorNombre, phase: 'refuted' }
          : prev
      );
      scheduleDissolve(sug.id, 5_000);
      return;
    }

    // ── Case C: same suggestion, still no refutation, but turn advanced ──
    if (
      animRefutadaRef.current === null &&
      animTurnoNumRef.current !== null &&
      partida.turnoActual > animTurnoNumRef.current
    ) {
      animRefutadaRef.current = '__no_refutation__';
      setAnim((prev) =>
        prev?.suggestion.id === sug.id ? { ...prev, phase: 'no_refutation' } : prev
      );
      scheduleDissolve(sug.id, 3_000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partida]);

  // Cleanup on unmount
  useEffect(() => {
    return clearAllTimers;
  }, [clearAllTimers]);

  // ── Render ──

  if (!anim || partida.estado !== 'en_curso') return null;

  const { suggestion: sug, turnoNumero, equipoNombre, refutadorNombre, phase } = anim;
  const isDim = phase === 'dissolving';

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 flex items-end justify-center',
        'transition-all duration-700 pointer-events-none',
        isDim ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      )}
    >
      <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent rounded-b-xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-lg px-4 pb-4 pt-2">
        <SuggestionCardStrip
          suggestion={sug}
          equipoNombre={equipoNombre}
          refutadorNombre={refutadorNombre}
          turnoNumero={turnoNumero}
          phase={phase === 'dissolving' ? 'pending' : phase}
        />
      </div>
    </div>
  );
}
