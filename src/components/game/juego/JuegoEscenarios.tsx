import { HABITACIONES, ESCENARIO_META } from '@/types/domain';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function JuegoEscenarios() {
  const t = await getTranslations('juego');
  return (
    <section aria-labelledby="escenarios-heading">
      <h2
        id="escenarios-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        {t('escenariosHeading')}
      </h2>

      {/* Room grid with individual scenario images */}
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-3">
        {HABITACIONES.map((habitacion) => {
          const meta = ESCENARIO_META[habitacion];
          return (
            <div
              key={habitacion}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden flex flex-col"
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
              <div className="p-2 flex flex-col items-center text-center gap-0.5">
                <span className="text-lg" role="img" aria-hidden="true">{meta.emoji}</span>
                <p className="text-xs font-semibold text-white leading-tight">{habitacion}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        {t('escenariosNota')}
      </p>
    </section>
  );
}
