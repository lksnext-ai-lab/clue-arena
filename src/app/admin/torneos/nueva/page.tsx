'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Layers3, Network, Swords, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';

type Format = 'round_robin' | 'single_bracket' | 'group_stage' | 'custom';

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

const FORMAT_OPTIONS: { value: Format; labelKey: string; summaryKey: string; icon: typeof Users }[] = [
  { value: 'round_robin', labelKey: 'torneoFormatoRoundRobin', summaryKey: 'torneoNuevoFormatSummaryRoundRobin', icon: Users },
  { value: 'single_bracket', labelKey: 'torneoFormatoBracket', summaryKey: 'torneoNuevoFormatSummaryBracket', icon: Swords },
  { value: 'group_stage', labelKey: 'torneoFormatoGrupos', summaryKey: 'torneoNuevoFormatSummaryGroups', icon: Network },
  { value: 'custom', labelKey: 'torneoFormatoCustom', summaryKey: 'torneoNuevoFormatSummaryCustom', icon: Layers3 },
];

type FormatInsight = {
  duration: string;
  intensity: string;
  mechanics: string;
  idealFor: string;
};

function buildFormatInsight(
  t: AdminTranslator,
  {
  format,
  playersPerGame,
  totalRounds,
  numGroups,
  groupRounds,
  advancePerGroup,
}: {
    format: Format;
    playersPerGame: number;
    totalRounds: number;
    numGroups: number;
    groupRounds: number;
    advancePerGroup: number;
  }
): FormatInsight {
  if (format === 'round_robin') {
    const appearances = totalRounds;
    const totalGames = totalRounds;
    return {
      duration: totalRounds >= 5 ? t('torneoNuevoDurationLong') : t('torneoNuevoDurationMedium'),
      intensity: t('torneoNuevoIntensityStable'),
      mechanics: t('torneoNuevoInsightRoundRobinMechanics', {
        totalRounds,
        totalGames,
        playersPerGame,
        appearances,
      }),
      idealFor: t('torneoNuevoInsightRoundRobinIdealFor', { totalRounds }),
    };
  }

  if (format === 'single_bracket') {
    const roundsToTitle = Math.max(1, Math.ceil(Math.log2(playersPerGame)));
    const totalGames = Math.max(1, playersPerGame - 1);
    return {
      duration: t('torneoNuevoDurationShort'),
      intensity: t('torneoNuevoIntensityHighPressure'),
      mechanics: t('torneoNuevoInsightBracketMechanics', { playersPerGame, roundsToTitle, totalGames }),
      idealFor: t('torneoNuevoInsightBracketIdealFor'),
    };
  }

  if (format === 'group_stage') {
    const qualified = numGroups * advancePerGroup;
    const groupGames = numGroups * groupRounds;
    const playoffRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, qualified))));
    return {
      duration:
        qualified >= 8 || groupRounds >= 4
          ? t('torneoNuevoDurationLong')
          : t('torneoNuevoDurationMediumLong'),
      intensity: t('torneoNuevoIntensityGrowing'),
      mechanics: t('torneoNuevoInsightGroupStageMechanics', {
        numGroups,
        groupRounds,
        playersPerGame,
        groupGames,
        advancePerGroup,
        qualified,
        playoffRounds,
      }),
      idealFor: t('torneoNuevoInsightGroupStageIdealFor'),
    };
  }

  return {
    duration: t('torneoNuevoDurationVariable'),
    intensity: t('torneoNuevoIntensityFlexible'),
    mechanics: t('torneoNuevoInsightCustomMechanics', { playersPerGame }),
    idealFor: t('torneoNuevoInsightCustomIdealFor'),
  };
}

function DiagramCard({
  x,
  y,
  width,
  height,
  title,
  value,
  detail,
  accent = false,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="16"
        fill={accent ? 'rgba(16,185,129,0.14)' : 'rgba(15,23,42,0.92)'}
        stroke={accent ? 'rgba(52,211,153,0.45)' : 'rgba(148,163,184,0.25)'}
      />
      <text
        x={x + width / 2}
        y={y + 16}
        textAnchor="middle"
        fill="rgba(148,163,184,0.95)"
        style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' }}
      >
        {title}
      </text>
      <text
        x={x + width / 2}
        y={y + 34}
        textAnchor="middle"
        fill={accent ? 'rgb(167 243 208)' : 'rgb(241 245 249)'}
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        {value}
      </text>
      {detail ? (
        <text
          x={x + width / 2}
          y={y + 49}
          textAnchor="middle"
          fill="rgb(125 211 252)"
          style={{ fontSize: 9 }}
        >
          {detail}
        </text>
      ) : null}
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(125,211,252,0.7)" strokeWidth="2.5" />
      <polyline
        points={`${x2 - 8},${y2 - 5} ${x2},${y2} ${x2 - 8},${y2 + 5}`}
        fill="none"
        stroke="rgba(125,211,252,0.7)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function CompetitionDiagram({
  t,
  format,
  playersPerGame,
  totalRounds,
  numGroups,
  groupRounds,
  advancePerGroup,
}: {
  t: AdminTranslator;
  format: Format;
  playersPerGame: number;
  totalRounds: number;
  numGroups: number;
  groupRounds: number;
  advancePerGroup: number;
}) {
  if (format === 'round_robin') {
    const visibleRounds = Math.min(totalRounds, 3);
    const cards = Array.from({ length: visibleRounds }, (_, index) => ({
      title: t('torneoRonda', { n: index + 1 }),
      value: t('torneoNuevoDiagramEveryonePlays'),
      detail: t('torneoNuevoDiagramTeamsPerTable', { count: playersPerGame }),
    }));
    const overflowCount = Math.max(0, totalRounds - visibleRounds);

    return (
      <svg viewBox="0 0 360 170" className="h-44 w-full" role="img" aria-label={t('torneoNuevoDiagramRoundRobinAria')}>
        {cards.map((card, index) => {
          const x = 14 + index * 82;
          return (
            <g key={card.title}>
              <DiagramCard x={x} y={36} width={70} height={58} title={card.title} value={card.value} detail={card.detail} />
              {index < cards.length - 1 ? <Arrow x1={x + 70} y1={65} x2={x + 82} y2={65} /> : null}
            </g>
          );
        })}
        {overflowCount > 0 ? (
          <>
            <DiagramCard
              x={14 + visibleRounds * 82}
              y={36}
              width={56}
              height={58}
              title={t('torneoNuevoDiagramMoreTitle')}
              value={`+${overflowCount}`}
              detail={t('torneoNuevoDiagramRoundsUnit')}
            />
            <Arrow x1={14 + visibleRounds * 82 + 56} y1={65} x2={280} y2={65} />
          </>
        ) : (
          <Arrow x1={14 + visibleRounds * 82 - 12} y1={65} x2={280} y2={65} />
        )}
        <DiagramCard
          x={250}
          y={108}
          width={92}
          height={48}
          title={t('torneoClasificacion')}
          value={t('torneoNuevoDiagramFinalTable')}
          detail={t('torneoNuevoDiagramRoundsDetail', { count: totalRounds })}
          accent
        />
        <line x1="296" y1="94" x2="296" y2="108" stroke="rgba(125,211,252,0.7)" strokeWidth="2.5" />
        <polyline
          points="291,102 296,108 301,102"
          fill="none"
          stroke="rgba(125,211,252,0.7)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (format === 'single_bracket') {
    const stages = [playersPerGame];
    while (stages[stages.length - 1] > 1 && stages.length < 4) {
      stages.push(Math.max(1, Math.ceil(stages[stages.length - 1] / 2)));
    }
    if (stages[stages.length - 1] !== 1) stages.push(1);
    const visibleStages = stages.slice(0, 4);

    return (
      <svg viewBox="0 0 360 170" className="h-44 w-full" role="img" aria-label={t('torneoNuevoDiagramBracketAria')}>
        {visibleStages.map((teams, index) => {
          const x = 14 + index * 84;
          const isChampion = teams === 1;
          const nextTeams = visibleStages[index + 1];
          return (
            <g key={`${teams}-${index}`}>
              <DiagramCard
                x={x}
                y={44}
                width={70}
                height={60}
                title={
                  isChampion
                    ? t('torneoNuevoDiagramStageFinal')
                    : index === 0
                      ? t('torneoNuevoDiagramStageEntry')
                      : t('torneoNuevoDiagramStageCut', { index })
                }
                value={isChampion ? t('torneoNuevoDiagramChampion') : t('torneoNuevoDiagramTeamsCount', { count: teams })}
                detail={
                  isChampion
                    ? t('torneoNuevoDiagramWinsTournament')
                    : nextTeams
                      ? t('torneoNuevoDiagramAdvanceCount', { count: nextTeams })
                      : t('torneoNuevoDiagramBestContinue')
                }
                accent={isChampion}
              />
              {index < visibleStages.length - 1 ? <Arrow x1={x + 70} y1={74} x2={x + 84} y2={74} /> : null}
            </g>
          );
        })}
      </svg>
    );
  }

  if (format === 'group_stage') {
    const qualified = numGroups * advancePerGroup;
    const playoffRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, qualified))));
    const extraGroups = Math.max(0, numGroups - 2);

    return (
      <svg viewBox="0 0 360 170" className="h-44 w-full" role="img" aria-label={t('torneoNuevoDiagramGroupStageAria')}>
        <DiagramCard
          x={12}
          y={22}
          width={88}
          height={56}
          title={t('torneoGrupo', { n: 1 })}
          value={t('torneoNuevoDiagramRoundsDetail', { count: groupRounds })}
          detail={t('torneoNuevoDiagramTeamsPerTable', { count: playersPerGame })}
        />
        <DiagramCard
          x={12}
          y={92}
          width={88}
          height={56}
          title={numGroups > 1 ? t('torneoGrupo', { n: 2 }) : t('torneoNuevoDiagramSingleGroup')}
          value={numGroups > 1 ? t('torneoNuevoDiagramRoundsDetail', { count: groupRounds }) : t('torneoNuevoDiagramNoDuplicate')}
          detail={numGroups > 1 ? t('torneoNuevoDiagramTeamsPerTable', { count: playersPerGame }) : t('torneoNuevoDiagramBasePhase')}
        />
        {extraGroups > 0 ? (
          <text x="56" y="162" textAnchor="middle" fill="rgb(148 163 184)" style={{ fontSize: 9 }}>
            {t('torneoNuevoDiagramExtraGroups', { count: extraGroups })}
          </text>
        ) : null}

        <line x1="100" y1="50" x2="154" y2="50" stroke="rgba(125,211,252,0.7)" strokeWidth="2.5" />
        <line x1="100" y1="120" x2="154" y2="120" stroke="rgba(125,211,252,0.7)" strokeWidth="2.5" />
        <line x1="154" y1="50" x2="154" y2="120" stroke="rgba(125,211,252,0.55)" strokeWidth="2.5" />
        <polyline
          points="148,80 154,86 160,80"
          fill="none"
          stroke="rgba(125,211,252,0.7)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <DiagramCard
          x={166}
          y={56}
          width={88}
          height={58}
          title={t('torneoNuevoDiagramQualify')}
          value={t('torneoNuevoDiagramTeamsCount', { count: qualified })}
          detail={t('torneoNuevoDiagramPerGroup', { count: advancePerGroup })}
          accent
        />
        <Arrow x1={254} y1={85} x2={282} y2={85} />
        <DiagramCard
          x={282}
          y={38}
          width={64}
          height={58}
          title={t('torneoNuevoDiagramPlayoff')}
          value={t('torneoNuevoDiagramRoundsDetail', { count: playoffRounds })}
          detail={t('torneoNuevoDiagramElimination')}
        />
        <line x1="314" y1="96" x2="314" y2="118" stroke="rgba(125,211,252,0.7)" strokeWidth="2.5" />
        <polyline
          points="309,112 314,118 319,112"
          fill="none"
          stroke="rgba(125,211,252,0.7)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <DiagramCard x={270} y={118} width={80} height={40} title={t('torneoNuevoDiagramStageFinal')} value={t('torneoNuevoDiagramChampion')} accent />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 360 170" className="h-44 w-full" role="img" aria-label={t('torneoNuevoDiagramCustomAria')}>
      <DiagramCard
        x={16}
        y={52}
        width={78}
        height={56}
        title={t('torneoNuevoDiagramBase')}
        value={t('torneoNuevoDiagramTeamsCount', { count: playersPerGame })}
        detail={t('torneoNuevoDiagramPerGame')}
      />
      <Arrow x1={94} y1={80} x2={138} y2={80} />
      <DiagramCard
        x={138}
        y={52}
        width={84}
        height={56}
        title={t('torneoNuevoDiagramAdjustments')}
        value={t('torneoNuevoDiagramPhasesCuts')}
        detail={t('torneoNuevoDiagramManualFlow')}
      />
      <Arrow x1={222} y1={80} x2={266} y2={80} />
      <DiagramCard
        x={266}
        y={52}
        width={78}
        height={56}
        title={t('torneoNuevoDiagramOutput')}
        value={t('torneoNuevoDiagramReady')}
        detail={t('torneoNuevoDiagramPublishable')}
        accent
      />
    </svg>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function NuevoTorneoPage() {
  const t = useTranslations('admin');
  const router = useRouter();

  const [name, setName] = useState('');
  const [format, setFormat] = useState<Format>('round_robin');
  const [playersPerGame, setPlayersPerGame] = useState(6);
  const [totalRounds, setTotalRounds] = useState(3);
  const [numGroups, setNumGroups] = useState(2);
  const [groupRounds, setGroupRounds] = useState(3);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [maxTurnosPorPartida, setMaxTurnosPorPartida] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildConfig = () => {
    const maxTurnos = maxTurnosPorPartida !== '' ? maxTurnosPorPartida : undefined;
    switch (format) {
      case 'round_robin':
        return { format, totalRounds, playersPerGame, maxTurnosPorPartida: maxTurnos };
      case 'single_bracket':
        return { format, playersPerGame, maxTurnosPorPartida: maxTurnos };
      case 'group_stage':
        return { format, numGroups, groupRounds, advancePerGroup, playersPerGame, maxTurnosPorPartida: maxTurnos };
      case 'custom':
        return { format, playersPerGame, maxTurnosPorPartida: maxTurnos };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>('/tournaments', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), config: buildConfig() }),
      });
      router.push(`/admin/torneos/${res.id}`);
    } catch {
      setError(t('torneoErrorCrear'));
      setSubmitting(false);
    }
  };

  const currentFormat = FORMAT_OPTIONS.find((option) => option.value === format) ?? FORMAT_OPTIONS[0];
  const formatInsight = buildFormatInsight(t, {
    format,
    playersPerGame,
    totalRounds,
    numGroups,
    groupRounds,
    advancePerGroup,
  });
  const inputClass =
    'w-full rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/20';
  const numberInputClass = `${inputClass} w-28 text-center`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_22%),linear-gradient(180deg,_#08111d_0%,_#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/torneos"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft size={16} />
            {t('gestionTorneos')}
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(6,10,20,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-8">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 bg-[radial-gradient(circle,_rgba(250,204,21,0.14),_transparent_68%)]" />

            <div className="relative space-y-6">
              <div className="space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {t('torneoNuevoTitle')}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  {t('torneoNuevoDesc')}
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('torneoNuevoSelectedFormat')}</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-emerald-200">
                    <currentFormat.icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-semibold text-white">{t(currentFormat.labelKey)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-emerald-200">
                        {formatInsight.duration}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        {formatInsight.intensity}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{formatInsight.mechanics}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      <span className="font-semibold text-slate-200">{t('torneoNuevoIdealForLabel')}</span> {formatInsight.idealFor}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{t('torneoNuevoDiagramLabel')}</p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_45%),linear-gradient(180deg,rgba(2,6,23,0.75),rgba(15,23,42,0.9))] p-3">
                      <CompetitionDiagram
                        t={t}
                        format={format}
                        playersPerGame={playersPerGame}
                        totalRounds={totalRounds}
                        numGroups={numGroups}
                        groupRounds={groupRounds}
                        advancePerGroup={advancePerGroup}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-8"
          >
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoNuevoSetupEyebrow')}</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">{t('torneoNuevoSetupTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {t('torneoNuevoSetupDesc')}
                </p>
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-[0.22em] text-slate-500">
                  {t('torneoNombre')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder={t('torneoNuevoNamePlaceholder')}
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.22em] text-slate-500">
                  {t('torneoFormato')}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FORMAT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = format === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-[24px] border p-4 transition-all ${
                          active
                            ? 'border-emerald-300/40 bg-emerald-300/10 shadow-[0_18px_40px_rgba(16,185,129,0.12)]'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="format"
                          value={option.value}
                          checked={active}
                          onChange={() => setFormat(option.value)}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-3">
                          <div className={`rounded-2xl border p-3 ${active ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{t(option.labelKey)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">{t(option.summaryKey)}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoNuevoFormatParametersEyebrow')}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {t('torneoNuevoFormatParametersDesc')}
                  </p>
                </div>

                <FieldRow
                  label={t('torneoConfigJugadoresPorPartida')}
                  hint={t('torneoNuevoHintPlayersPerGame')}
                >
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={playersPerGame}
                    onChange={(e) => setPlayersPerGame(Number(e.target.value))}
                    className={numberInputClass}
                  />
                </FieldRow>

                <FieldRow
                  label={t('torneoConfigMaxTurnosPorPartida')}
                  hint={t('torneoNuevoHintMaxTurns')}
                >
                  <input
                    type="number"
                    min={1}
                    value={maxTurnosPorPartida}
                    onChange={(e) => setMaxTurnosPorPartida(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={t('torneoNuevoNoLimit')}
                    className={numberInputClass}
                  />
                </FieldRow>

                {format === 'round_robin' ? (
                  <FieldRow
                    label={t('torneoConfigTotalRondas')}
                    hint={t('torneoNuevoHintTotalRounds')}
                  >
                    <input
                      type="number"
                      min={3}
                      max={10}
                      value={totalRounds}
                      onChange={(e) => setTotalRounds(Number(e.target.value))}
                      className={numberInputClass}
                    />
                  </FieldRow>
                ) : null}

                {format === 'group_stage' ? (
                  <>
                    <FieldRow
                      label={t('torneoConfigNumGrupos')}
                      hint={t('torneoNuevoHintNumGroups')}
                    >
                      <input
                        type="number"
                        min={2}
                        max={8}
                        value={numGroups}
                        onChange={(e) => setNumGroups(Number(e.target.value))}
                        className={numberInputClass}
                      />
                    </FieldRow>
                    <FieldRow
                      label={t('torneoConfigRondasGrupo')}
                      hint={t('torneoNuevoHintGroupRounds')}
                    >
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={groupRounds}
                        onChange={(e) => setGroupRounds(Number(e.target.value))}
                        className={numberInputClass}
                      />
                    </FieldRow>
                    <FieldRow
                      label={t('torneoConfigAvancePorGrupo')}
                      hint={t('torneoNuevoHintAdvancePerGroup')}
                    >
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={advancePerGroup}
                        onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
                        className={numberInputClass}
                      />
                    </FieldRow>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/admin/torneos"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
                >
                  <ArrowLeft size={16} />
                  {t('torneoNuevoCancel')}
                </Link>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? t('torneoCreando') : t('torneoNuevoSubmit')}
                  {!submitting ? <ArrowRight size={16} /> : null}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
