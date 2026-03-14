'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';

interface TimelinePoint {
  index: number;
  gameId: string;
  gameName: string;
  points: number;
  cumulativePoints: number;
  playedAt: string;
}

interface TimelineTournament {
  id: string;
  name: string;
  status: string;
}

interface TeamTimelineResponse {
  teamId: string;
  scope: 'global' | 'tournament';
  tournament: TimelineTournament | null;
  tournaments: TimelineTournament[];
  timeline: TimelinePoint[];
}

interface TeamPointsTimelineProps {
  teamId: string;
}

export function TeamPointsTimeline({ teamId }: TeamPointsTimelineProps) {
  const t = useTranslations('equipo');
  const [data, setData] = useState<TimelinePoint[]>([]);
  const [tournaments, setTournaments] = useState<TimelineTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('global');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const query =
          selectedTournamentId !== 'global'
            ? `?tournamentId=${encodeURIComponent(selectedTournamentId)}`
            : '';
        const result = await apiFetch<TeamTimelineResponse>(`/teams/${teamId}/timeline${query}`);
        if (!cancelled) {
          setData(result.timeline);
          setTournaments(result.tournaments);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedTournamentId, teamId]);

  return (
    <section
      className="rounded-[28px] border p-6"
      style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(9, 17, 31, 0.84)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
        >
          <LineChart size={20} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
            {t('panelTimelineEyebrow')}
          </p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: '#f8fafc' }}>
            {t('panelTimelineTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {t('panelTimelineDesc')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:max-w-sm">
        <label
          htmlFor="team-points-scope"
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: '#64748b' }}
        >
          {t('panelTimelineFilterLabel')}
        </label>
        <select
          id="team-points-scope"
          value={selectedTournamentId}
          onChange={(event) => setSelectedTournamentId(event.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-400/30"
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
          }}
        >
          <option value="global">{t('panelTimelineFilterGlobal')}</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div
          className="mt-5 rounded-3xl border px-5 py-16 text-center text-sm"
          style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.5)', color: '#94a3b8' }}
        >
          {t('panelTimelineLoading')}
        </div>
      ) : hasError ? (
        <div
          className="mt-5 rounded-3xl border px-5 py-16 text-center text-sm"
          style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(127,29,29,0.24)', color: '#fecaca' }}
        >
          {t('panelTimelineError')}
        </div>
      ) : data.length === 0 ? (
        <div
          className="mt-5 rounded-3xl border px-5 py-16 text-center"
          style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.5)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
            {t('panelTimelineEmptyTitle')}
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {t('panelTimelineEmptyDesc')}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricStat label={t('panelTimelineMetricGames')} value={String(data.length)} />
            <MetricStat
              label={t('panelTimelineMetricLatest')}
              value={formatPoints(data[data.length - 1]?.points ?? 0)}
            />
            <MetricStat
              label={t('panelTimelineMetricTotal')}
              value={formatPoints(data[data.length - 1]?.cumulativePoints ?? 0)}
            />
          </div>

          <div className="mt-5 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="teamPointsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis
                  dataKey="playedAt"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) =>
                    new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(value))
                  }
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => `${value}`}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(125,211,252,0.35)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as TimelinePoint;
                    return (
                      <div
                        className="rounded-2xl border px-4 py-3 shadow-xl"
                        style={{ borderColor: 'rgba(148,163,184,0.18)', background: 'rgba(8,17,29,0.96)' }}
                      >
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                          {point.gameName}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: '#94a3b8' }}>
                          {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(point.playedAt))}
                        </p>
                        <p className="mt-3 text-xs" style={{ color: '#7dd3fc' }}>
                          {t('panelTimelineTooltipGame')}: <strong>{formatPoints(point.points)}</strong>
                        </p>
                        <p className="mt-1 text-xs" style={{ color: '#fcd34d' }}>
                          {t('panelTimelineTooltipTotal')}: <strong>{formatPoints(point.cumulativePoints)}</strong>
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePoints"
                  stroke="#22d3ee"
                  fill="url(#teamPointsFill)"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#08111d', stroke: '#67e8f9' }}
                  activeDot={{ r: 6, fill: '#67e8f9', stroke: '#08111d', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.52)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#64748b' }}>
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold" style={{ color: '#f8fafc' }}>
        {value}
      </p>
    </div>
  );
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value);
}
