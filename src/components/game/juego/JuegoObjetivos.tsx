import { Brain, Cpu, Users, BarChart3 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function JuegoObjetivos() {
  const t = await getTranslations('juego');

  const OBJETIVO_ITEMS = [
    { id: 'OBJ-01', Icon: Brain,     titulo: t('obj01Titulo'), descripcion: t('obj01Desc') },
    { id: 'OBJ-02', Icon: Cpu,      titulo: t('obj02Titulo'), descripcion: t('obj02Desc') },
    { id: 'OBJ-03', Icon: Users,    titulo: t('obj03Titulo'), descripcion: t('obj03Desc') },
    { id: 'OBJ-04', Icon: BarChart3, titulo: t('obj04Titulo'), descripcion: t('obj04Desc') },
  ];

  return (
    <section aria-labelledby="objetivos-heading">
      <h2
        id="objetivos-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        {t('objetivosHeading')}
      </h2>

      {/* Objetivo cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {OBJETIVO_ITEMS.map(({ id, Icon, titulo, descripcion }) => (
          <div
            key={id}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} className="text-cyan-400 shrink-0" />
              <span className="text-xs text-slate-500 font-mono">{id}</span>
            </div>
            <p className="text-sm font-semibold text-white mt-2 mb-1">{titulo}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
