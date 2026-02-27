import { HABITACIONES, ESCENARIO_META } from '@/types/domain';
import Image from 'next/image';

export function JuegoEscenarios() {
  return (
    <section aria-labelledby="escenarios-heading">
      <h2
        id="escenarios-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Escenarios — habitaciones de la empresa
      </h2>

      {/* Room grid with individual scenario images */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {HABITACIONES.map((habitacion) => {
          const meta = ESCENARIO_META[habitacion];
          return (
            <div
              key={habitacion}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
            >
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={meta.imagen}
                  alt={habitacion}
                  fill
                  className="object-cover object-top"
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-base" role="img" aria-hidden="true">{meta.emoji}</span>
                <p className="text-xs font-semibold text-slate-200 leading-tight">{habitacion}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        9 habitaciones forman la empresa. El crimen ocurrió en una de ellas. Las sugerencias siempre han de especificar una habitación.
      </p>
    </section>
  );
}
