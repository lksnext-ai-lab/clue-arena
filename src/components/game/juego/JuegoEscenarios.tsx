import { HABITACIONES, ESCENARIO_META } from '@/types/domain';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function JuegoEscenarios() {
  const t = await getTranslations('juego');
  return (
    <section aria-labelledby="escenarios-heading" className="space-y-5">
      <h2
        id="escenarios-heading"
        className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400"
      >
        {t('escenariosHeading')}
      </h2>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-9">
        {HABITACIONES.map((habitacion) => {
          const meta = ESCENARIO_META[habitacion];
          return (
            <div
              key={habitacion}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/60 shadow-[0_18px_40px_rgba(2,6,23,0.22)]"
            >
              <div className="relative w-full" style={{ aspectRatio: '2/3' }}>
                <Image
                  src={meta.imagen}
                  alt={habitacion}
                  fill
                  quality={75}
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 16vw, 11vw"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5 p-2 text-center">
                <span className="text-lg" role="img" aria-hidden="true">{meta.emoji}</span>
                <p className="text-xs font-semibold text-white leading-tight">{habitacion}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-600">
        {t('escenariosNota')}
      </p>
    </section>
  );
}
