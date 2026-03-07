// /admin/torneos/nueva — Create tournament form
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';

type Format = 'round_robin' | 'single_bracket' | 'group_stage' | 'custom';

const FORMAT_OPTIONS: { value: Format; labelKey: string }[] = [
  { value: 'round_robin',    labelKey: 'torneoFormatoRoundRobin' },
  { value: 'single_bracket', labelKey: 'torneoFormatoBracket'    },
  { value: 'group_stage',    labelKey: 'torneoFormatoGrupos'     },
  { value: 'custom',         labelKey: 'torneoFormatoCustom'     },
];

export default function NuevoTorneoPage() {
  const t      = useTranslations('admin');
  const router = useRouter();

  const [name,           setName]           = useState('');
  const [format,         setFormat]         = useState<Format>('round_robin');
  const [playersPerGame, setPlayersPerGame] = useState(6);
  const [totalRounds,    setTotalRounds]    = useState(3);
  const [numGroups,      setNumGroups]      = useState(2);
  const [groupRounds,    setGroupRounds]    = useState(3);
  const [advancePerGroup,setAdvancePerGroup]= useState(2);
  const [maxTurnosPorPartida, setMaxTurnosPorPartida] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

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

  const inputClass =
    'w-full rounded-md px-3 py-2 text-sm bg-slate-900/70 text-slate-200 border border-slate-700 outline-none focus:ring-2 focus:ring-cyan-500';
  const numberInputClass = `${inputClass} w-28`;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 text-slate-200">
      <header className="flex items-center gap-4">
        <Link
          href="/admin/torneos"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← {t('gestionTorneos')}
        </Link>
        <h1 className="text-2xl font-bold text-cyan-400">Nuevo Torneo</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="px-4 py-3 rounded-md text-sm bg-red-900/40 text-red-300 border border-red-500/30">
            {error}
          </p>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs mb-1 text-slate-400">{t('torneoNombre')} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Ej: Copa Cluedo Arena 2026"
            maxLength={120}
            required
          />
        </div>

        {/* Format selector */}
        <div>
          <label className="block text-xs mb-2 text-slate-400">{t('torneoFormato')} *</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer border transition-colors ${
                  format === opt.value
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                  className="accent-cyan-400"
                />
                <span className="text-sm font-medium">{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Format-specific fields */}
        <div className="rounded-xl p-4 bg-slate-800 border border-slate-700 space-y-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Configuración del formato
          </p>

          {/* Players per game — shown for all formats */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-300">{t('torneoConfigJugadoresPorPartida')}</label>
            <input
              type="number"
              min={2}
              max={6}
              value={playersPerGame}
              onChange={(e) => setPlayersPerGame(Number(e.target.value))}
              className={numberInputClass}
            />
          </div>

          {/* Max turns per game — optional, shown for all formats */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-300">{t('torneoConfigMaxTurnosPorPartida')}</label>
            <input
              type="number"
              min={1}
              value={maxTurnosPorPartida}
              onChange={(e) => setMaxTurnosPorPartida(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Sin límite"
              className={numberInputClass}
            />
          </div>

          {format === 'round_robin' && (
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-slate-300">{t('torneoConfigTotalRondas')}</label>
              <input
                type="number"
                min={3}
                max={10}
                value={totalRounds}
                onChange={(e) => setTotalRounds(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          )}

          {format === 'group_stage' && (
            <>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-slate-300">{t('torneoConfigNumGrupos')}</label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={numGroups}
                  onChange={(e) => setNumGroups(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-slate-300">{t('torneoConfigRondasGrupo')}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={groupRounds}
                  onChange={(e) => setGroupRounds(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-slate-300">{t('torneoConfigAvancePorGrupo')}</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={advancePerGroup}
                  onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href="/admin/torneos"
            className="px-5 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-5 py-2 rounded-md text-sm font-medium bg-cyan-500 text-slate-900 hover:bg-cyan-400 disabled:opacity-60 transition-colors"
          >
            {submitting ? t('torneoCreando') : 'Crear torneo'}
          </button>
        </div>
      </form>
    </div>
  );
}
