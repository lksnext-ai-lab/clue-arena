import { Lightbulb, ShieldOff, Target, Medal } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function JuegoMecanica() {
  const t = await getTranslations('juego');

  const STEPS = [
    { numero: 1, Icon: Lightbulb, titulo: t('step01Titulo'), descripcion: t('step01Desc') },
    { numero: 2, Icon: ShieldOff, titulo: t('step02Titulo'), descripcion: t('step02Desc') },
    { numero: 3, Icon: Target,    titulo: t('step03Titulo'), descripcion: t('step03Desc') },
    { numero: 4, Icon: Medal,     titulo: t('step04Titulo'), descripcion: t('step04Desc') },
  ];

  const NOTES = [t('mecNote01'), t('mecNote02'), t('mecNote03')];

  return (
    <section aria-labelledby="mecanica-heading" className="space-y-5">
      <h2
        id="mecanica-heading"
        className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400"
      >
        {t('mecanicaHeading')}
      </h2>

      <ol className="grid list-none gap-4 p-0 m-0 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(({ numero, Icon, titulo, descripcion }) => (
          <li
            key={numero}
            className="relative rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.22)]"
          >
            {/* Step number badge */}
            <span
              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-cyan-400"
              style={{ background: 'rgba(34,211,238,0.15)' }}
            >
              {numero}
            </span>
            <Icon size={22} className="text-cyan-400" />
            <p className="text-sm font-semibold text-white mt-3 mb-1">{titulo}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{descripcion}</p>
          </li>
        ))}
      </ol>

      {/* Notes for agents */}
      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-700/40 bg-slate-800/40 p-4 sm:grid-cols-3">
        {NOTES.map((note) => (
          <p key={note} className="text-xs text-slate-500 leading-relaxed flex gap-2">
            <span className="text-slate-600 shrink-0">—</span>
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}
