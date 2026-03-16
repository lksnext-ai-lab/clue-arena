'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Orbit,
  ShieldCheck,
  Sparkles,
  Swords,
  TriangleAlert,
} from 'lucide-react';
import { CreateTrainingGameSchema, type CreateTrainingGameInput } from '@/lib/schemas/training';
import { apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

const BOT_PRESETS = [
  { value: 1, title: 'Duelo rápido', detail: '1 bot para iterar sin ruido.' },
  { value: 2, title: 'Mesa ligera', detail: 'Buen equilibrio para probar cambios.' },
  { value: 3, title: 'Escenario estándar', detail: 'Simulación parecida a una mesa real.' },
  { value: 4, title: 'Presión alta', detail: 'Más cruces y menos turnos previsibles.' },
  { value: 5, title: 'Caos controlado', detail: 'Máxima densidad de señales y bloqueos.' },
] as const;

const TURN_PRESETS = [
  { value: 20, title: 'Sprint', detail: 'Detecta rápido si la estrategia despega.' },
  { value: 50, title: 'Base', detail: 'Configuración recomendada para iterar prompts.' },
  { value: 100, title: 'Extendida', detail: 'Permite observar decisiones con más contexto.' },
  { value: 150, title: 'Resistencia', detail: 'Útil para agentes más prudentes o defensivos.' },
  { value: 200, title: 'Maratón', detail: 'Explora sesiones largas y patrones atípicos.' },
] as const;

function getSessionProfile(numBots: number, maxTurnos: number) {
  if (numBots >= 5 || maxTurnos >= 150) {
    return {
      label: 'Alta complejidad',
      detail: 'Sesión larga y con bastante interacción entre bots.',
      tone: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100',
    };
  }

  if (numBots <= 2 && maxTurnos <= 50) {
    return {
      label: 'Iteración rápida',
      detail: 'Ideal para validar cambios pequeños del agente.',
      tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    };
  }

  return {
    label: 'Sesión equilibrada',
    detail: 'Buen punto medio entre velocidad y variedad táctica.',
    tone: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
  };
}

export default function NuevaEntrenamientoPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTrainingGameInput>({
    resolver: zodResolver(CreateTrainingGameSchema),
    defaultValues: { numBots: 2, maxTurnos: 50, seed: '' },
  });

  const numBots = watch('numBots') ?? 2;
  const maxTurnos = watch('maxTurnos') ?? 50;
  const seed = watch('seed')?.trim() ?? '';
  const sessionProfile = getSessionProfile(numBots, maxTurnos);

  const onSubmit = async (data: CreateTrainingGameInput) => {
    setSubmitError(null);
    try {
      const result = await apiFetch<{ id: string }>('/training/games', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push(`/equipo/entrenamiento/${result.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al iniciar la partida');
    }
  };

  return (
    <div
      className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #17324c 0%, #08111d 46%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-6 py-7 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:px-8">
          <div className="absolute -right-8 top-0 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative max-w-3xl space-y-4">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => router.push('/equipo/entrenamiento')}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition-colors hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al laboratorio
              </button>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Nueva sesión guiada
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Configura una partida de entrenamiento que se sienta útil desde el primer turno
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Ajusta el tamaño de la mesa, el techo de turnos y la semilla si quieres comparar
                  ejecuciones con precisión. Todo está pensado para iterar sin salir del flujo de la app.
                </p>
              </div>
            </div>
          </div>
        </section>

        {submitError && (
          <div className="rounded-[24px] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100 shadow-[0_18px_50px_rgba(127,29,29,0.2)]">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_22rem]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,17,29,0.94),rgba(15,23,42,0.9))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)] sm:p-7">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Composición de mesa
                </p>
                <h2 className="text-2xl font-semibold text-white">Elige la presión competitiva</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                  Cuantos más bots añadas, más interacciones cruzadas, bloqueos y pistas indirectas verá tu agente.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {BOT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setValue('numBots', preset.value, { shouldDirty: true, shouldValidate: true })}
                    aria-pressed={numBots === preset.value}
                    className={cn(
                      'group rounded-[24px] border p-4 text-left transition-all duration-200',
                      numBots === preset.value
                        ? 'border-cyan-300/35 bg-cyan-400/10 shadow-[0_18px_45px_rgba(34,211,238,0.12)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45 text-cyan-200">
                        <Bot size={18} />
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]',
                          numBots === preset.value
                            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                            : 'border-white/10 bg-white/[0.03] text-slate-400'
                        )}
                      >
                        {preset.value} bot{preset.value > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">{preset.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{preset.detail}</p>
                  </button>
                ))}
              </div>

              {errors.numBots && <p className="mt-3 text-xs text-red-300">{errors.numBots.message}</p>}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,17,29,0.94),rgba(15,23,42,0.9))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)] sm:p-7">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                  Ritmo de sesión
                </p>
                <h2 className="text-2xl font-semibold text-white">Define cuánto quieres estirar la partida</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                  Usa presets para iterar rápido o amplía el margen si quieres observar cómo responde el agente bajo fatiga táctica.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {TURN_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setValue('maxTurnos', preset.value, { shouldDirty: true, shouldValidate: true })}
                    aria-pressed={maxTurnos === preset.value}
                    className={cn(
                      'rounded-[24px] border p-4 text-left transition-all duration-200',
                      maxTurnos === preset.value
                        ? 'border-amber-300/30 bg-amber-400/10 shadow-[0_18px_45px_rgba(251,191,36,0.12)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45 text-amber-200">
                        <Orbit size={18} />
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]',
                          maxTurnos === preset.value
                            ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                            : 'border-white/10 bg-white/[0.03] text-slate-400'
                        )}
                      >
                        {preset.value}
                      </span>
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">{preset.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{preset.detail}</p>
                  </button>
                ))}
              </div>

              {errors.maxTurnos && <p className="mt-3 text-xs text-red-300">{errors.maxTurnos.message}</p>}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,17,29,0.94),rgba(15,23,42,0.9))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)] sm:p-7">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                    Reproducibilidad
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Añade una semilla si quieres comparar ejecuciones</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Mantener la misma semilla conserva la distribución de cartas y el sobre secreto, así puedes validar cambios del prompt o del backend con una base estable.
                  </p>
                </div>

                <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-400/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    Estado actual
                  </p>
                  <p className="mt-3 font-mono text-sm text-white">
                    {seed || 'random-seed-at-runtime'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                    {seed
                      ? 'La sesión será repetible si mantienes esta configuración.'
                      : 'La app generará una semilla aleatoria reproducible al iniciar la partida.'}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="seed" className="text-sm font-semibold text-slate-100">
                  Semilla opcional
                </label>
                <input
                  id="seed"
                  type="text"
                  placeholder="Ej: calibracion-v3 o 2026-ronda-a"
                  {...register('seed')}
                  className="mt-3 w-full rounded-[20px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/15"
                />
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Úsala cuando quieras comparar dos versiones del agente en el mismo escenario.
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,17,29,0.96),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Resumen operativo
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Así se verá la sesión</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-cyan-200">
                  <Swords size={18} />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <SummaryItem label="Tu agente" value="1 jugador" />
                <SummaryItem label="Bots rivales" value={`${numBots} oponentes`} />
                <SummaryItem label="Mesa total" value={`${numBots + 1} participantes`} />
                <SummaryItem label="Cierre automático" value={`${maxTurnos} turnos`} />
                <SummaryItem label="Semilla" value={seed || 'Aleatoria'} mono={Boolean(seed)} />
              </div>

              <div className={cn('mt-5 rounded-[22px] border px-4 py-4', sessionProfile.tone)}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} />
                  {sessionProfile.label}
                </div>
                <p className="mt-2 text-sm leading-6 opacity-90">{sessionProfile.detail}</p>
              </div>

              <div className="mt-5 rounded-[22px] border border-amber-300/18 bg-amber-400/8 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <TriangleAlert size={16} />
                  No afecta al ranking oficial
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-50/75">
                  Esta partida es perfecta para probar ideas, pero no sumará puntos ni alterará la clasificación del evento.
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,17,29,0.96),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Siguiente paso
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Al iniciar, te llevaremos directamente al detalle de la partida para seguir turnos, estado y trazas del entrenamiento.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Iniciando…' : 'Iniciar entrenamiento'}
                  {!isSubmitting && <ArrowRight size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/equipo/entrenamiento')}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  Cancelar
                </button>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn('text-sm font-semibold text-white', mono && 'font-mono text-[13px]')}>
        {value}
      </span>
    </div>
  );
}
