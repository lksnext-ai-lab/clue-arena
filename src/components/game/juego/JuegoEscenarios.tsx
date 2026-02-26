import { HABITACIONES } from '@/types/domain';

/** Mapping from Cluedo domain name → corporate scenario slug and display name */
const HABITACION_ESCENARIO: Record<string, { slug: string; nombre: string; emoji: string }> = {
  'Cocina':          { slug: 'la-sala-de-servidores', nombre: 'La Sala de Servidores',       emoji: '🖥️' },
  'Salón de baile':  { slug: 'el-open-space',          nombre: 'El Open Space',               emoji: '💬' },
  'Conservatorio':   { slug: 'la-cafeteria',            nombre: 'La Cafetería',                emoji: '☕' },
  'Comedor':         { slug: 'recursos-humanos',        nombre: 'Recursos Humanos',            emoji: '🔒' },
  'Sala de billar':  { slug: 'el-despacho-del-ceo',    nombre: 'El Despacho del CEO',         emoji: '👑' },
  'Biblioteca':      { slug: 'la-sala-de-juntas',      nombre: 'La Sala de Juntas',           emoji: '♟️' },
  'Sala de estar':   { slug: 'el-almacen-de-it',       nombre: 'El Almacén de IT',            emoji: '📦' },
  'Estudio':         { slug: 'el-laboratorio',          nombre: 'El Laboratorio de Innovación', emoji: '🤖' },
  'Vestíbulo':       { slug: 'la-zona-de-descanso',    nombre: 'La Zona de Descanso',         emoji: '❓' },
};

export function JuegoEscenarios() {
  return (
    <section aria-labelledby="escenarios-heading">
      <h2
        id="escenarios-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Escenarios — habitaciones de la mansión
      </h2>

      {/* Room grid with individual scenario images */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {HABITACIONES.map((hab) => {
          const escenario = HABITACION_ESCENARIO[hab];
          return (
            <div
              key={hab}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/game/escenarios/${escenario.slug}.png`}
                alt={escenario.nombre}
                className="w-full object-cover object-top"
                style={{ aspectRatio: '16/9' }}
              />
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-base" role="img" aria-hidden="true">{escenario.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-200 leading-tight">{escenario.nombre}</p>
                  <p className="text-xs text-slate-500 leading-tight">{hab}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        9 habitaciones forman la mansión corporativa. El crimen ocurrió en una de ellas. Las sugerencias siempre han de especificar una habitación.
      </p>
    </section>
  );
}
