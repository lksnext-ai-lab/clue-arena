import Image from 'next/image';
import { ARMAS, ARMA_META } from '@/types/domain';

export function JuegoArmas() {
  return (
    <section aria-labelledby="armas-heading">
      <h2
        id="armas-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Armas del crimen
      </h2>

      {/* Weapon cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ARMAS.map((arma) => {
          const meta = ARMA_META[arma];
          return (
            <div
              key={arma}
              className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden flex flex-col"
            >
              {/* Weapon card image */}
              <div className="relative w-full" style={{ aspectRatio: '2/3' }}>
                <Image
                  src={meta.imagen}
                  alt={arma}
                  fill
                  unoptimized
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
              </div>
              {/* Name */}
              <div className="p-2 flex flex-col items-center text-center gap-0.5">
                <span className="text-lg" role="img" aria-label={arma}>
                  {meta.emoji}
                </span>
                <p className="text-xs font-semibold text-white leading-tight">{arma}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Una de estas 6 armas figura en el sobre secreto. Las otras 5 están repartidas entre los jugadores.
      </p>
    </section>
  );
}
