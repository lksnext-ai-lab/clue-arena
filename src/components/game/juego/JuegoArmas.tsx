import Image from 'next/image';
import { ARMAS, ARMA_META } from '@/types/domain';
import { getTranslations } from 'next-intl/server';

export async function JuegoArmas() {
  const t = await getTranslations('juego');
  return (
    <section aria-labelledby="armas-heading" className="space-y-5">
      <h2
        id="armas-heading"
        className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400"
      >
        {t('armasHeading')}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ARMAS.map((arma) => {
          const meta = ARMA_META[arma];
          return (
            <div
              key={arma}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/60 shadow-[0_18px_40px_rgba(2,6,23,0.22)]"
            >
              {/* Weapon card image */}
              <div className="relative w-full" style={{ aspectRatio: '2/3' }}>
                <Image
                  src={meta.imagen}
                  alt={arma}
                  fill
                  quality={75}
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
              </div>
              {/* Name */}
              <div className="flex flex-col items-center gap-0.5 p-2 text-center">
                <span className="text-lg" role="img" aria-label={arma}>
                  {meta.emoji}
                </span>
                <p className="text-xs font-semibold text-white leading-tight">{arma}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-600">
        {t('armasNota')}
      </p>
    </section>
  );
}
