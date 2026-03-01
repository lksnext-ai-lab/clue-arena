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
    <section aria-labelledby="mecanica-heading">
      <h2
        id="mecanica-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        {t('mecanicaHeading')}
      </h2>

      <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 list-none p-0 m-0">
        {STEPS.map(({ numero, Icon, titulo, descripcion }) => (
          <li
            key={numero}
            className="relative bg-slate-800/60 border border-slate-700/50 rounded-xl p-5"
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
      <div className="mt-5 bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
