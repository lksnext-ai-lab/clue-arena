import { SOSPECHOSOS } from '@/types/domain';

interface PersonajeMeta {
  color: string;
  descripcion: string;
}

const PERSONAJE_META: Record<string, PersonajeMeta> = {
  'Coronel Mostaza':  { color: '#eab308', descripcion: 'Militar retirado, experto en estrategia y presión.' },
  'Señora Pavo Real': { color: '#3b82f6', descripcion: 'Directora ejecutiva con secretos corporativos enterrados.' },
  'Reverendo Verde':  { color: '#22c55e', descripcion: 'Consultor inesperadamente ambicioso y bien conectado.' },
  'Señora Escarlata': { color: '#ef4444', descripcion: 'Investigadora brillante con métodos cuestionables.' },
  'Profesor Ciruela': { color: '#a855f7', descripcion: 'Científico de datos con motivos ocultos y frialdad analítica.' },
  'Señorita Amapola': { color: '#ec4899', descripcion: 'Asistente personal que escucha todo y olvida poco.' },
};

export function JuegoPersonajes() {
  return (
    <section aria-labelledby="personajes-heading">
      <h2
        id="personajes-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Personajes sospechosos
      </h2>

      {/* Reference image */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/50 mb-5"
        style={{ height: 280 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/game/juego-personajes.jpg"
          alt="Galería de personajes sospechosos del evento"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      {/* Character cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SOSPECHOSOS.map((nombre) => {
          const meta = PERSONAJE_META[nombre] ?? { color: '#64748b', descripcion: '' };
          return (
            <div
              key={nombre}
              className="rounded-lg p-3 flex flex-col"
              style={{
                background: 'rgba(30,41,59,0.6)',
                border: `1px solid ${meta.color}40`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />
                <span className="text-xs font-semibold text-white leading-tight">{nombre}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 leading-tight">{meta.descripcion}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Los 6 sospechosos participan en cada partida. El sobre secreto contiene exactamente uno de ellos.
      </p>
    </section>
  );
}
