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
                  unoptimized
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 50vw, 33vw"
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
        9 habitaciones forman la empresa. El crimen ocurrió en una de ellas. Las sugerencias siempre han de especificar una habitación.
      </p>
    </section>
  );
}
