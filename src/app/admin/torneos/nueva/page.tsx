'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Layers3, Network, Plus, Swords, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';

type Format = 'round_robin' | 'single_bracket' | 'group_stage' | 'custom';

const FORMAT_OPTIONS: { value: Format; labelKey: string; icon: typeof Users; summary: string }[] = [
  { value: 'round_robin', labelKey: 'torneoFormatoRoundRobin', icon: Users, summary: 'Todos compiten varias veces para obtener una clasificación estable.' },
  { value: 'single_bracket', labelKey: 'torneoFormatoBracket', icon: Swords, summary: 'Cruces directos para una narrativa rápida y decisiva.' },
  { value: 'group_stage', labelKey: 'torneoFormatoGrupos', icon: Network, summary: 'Fase inicial por grupos y cierre con playoffs para los mejores.' },
  { value: 'custom', labelKey: 'torneoFormatoCustom', icon: Layers3, summary: 'Base flexible para experimentar con formatos propios.' },
];

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
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">
                <Plus size={14} />
                Nuevo dispositivo competitivo
              </div>

              <div className="space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Diseña un torneo que se pueda operar bien
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  El formato correcto no solo ordena a los equipos: también simplifica inscripciones, acelera la toma de decisiones y da ritmo al evento.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Formato seleccionado</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-emerald-200">
                    <currentFormat.icon size={22} />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">{t(currentFormat.labelKey)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{currentFormat.summary}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Lectura</p>
                  <p className="mt-3 text-lg font-semibold text-white">Clara</p>
                  <p className="mt-1 text-sm text-slate-400">Parámetros visibles y comprensibles.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Escalado</p>
                  <p className="mt-3 text-lg font-semibold text-white">Flexible</p>
                  <p className="mt-1 text-sm text-slate-400">Ajusta rondas, grupos o límite de turnos.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Salida</p>
                  <p className="mt-3 text-lg font-semibold text-white">Operable</p>
                  <p className="mt-1 text-sm text-slate-400">Lista para inscribir equipos y arrancar.</p>
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
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Configuración</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Define la estructura base</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Crea una plantilla de operación sólida. Después podrás inscribir equipos y ejecutar rondas desde el detalle del torneo.
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
                  placeholder="Ej: Copa Clue Arena 2026"
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
                            <p className="mt-1 text-xs leading-5 text-slate-400">{option.summary}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Parámetros del formato</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Ajusta solo lo esencial. El objetivo es que el equipo de operación entienda de un vistazo cómo se comportará el torneo.
                  </p>
                </div>

                <FieldRow
                  label={t('torneoConfigJugadoresPorPartida')}
                  hint="Número máximo de equipos que convivirán en cada partida."
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
                  hint="Déjalo vacío si no necesitas un tope duro por partida."
                >
                  <input
                    type="number"
                    min={1}
                    value={maxTurnosPorPartida}
                    onChange={(e) => setMaxTurnosPorPartida(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Sin límite"
                    className={numberInputClass}
                  />
                </FieldRow>

                {format === 'round_robin' ? (
                  <FieldRow
                    label={t('torneoConfigTotalRondas')}
                    hint="Más rondas dan una clasificación más robusta, pero alargan el calendario."
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
                      hint="Reparte la inscripción en grupos equilibrados."
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
                      hint="Número de enfrentamientos que vivirá cada grupo antes del corte."
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
                      hint="Define cuántos equipos saltan a playoffs desde cada grupo."
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
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? t('torneoCreando') : 'Crear torneo'}
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
