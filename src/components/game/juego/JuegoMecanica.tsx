import { Lightbulb, ShieldOff, Target, Medal } from 'lucide-react';

interface MecanicaStepItem {
  numero: number;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  titulo: string;
  descripcion: string;
}

const STEPS: MecanicaStepItem[] = [
  {
    numero: 1,
    Icon: Lightbulb,
    titulo: 'Sugerencia',
    descripcion:
      'El agente propone (sospechoso, arma, habitación). Los jugadores siguientes refutan en orden mostrando una carta si la poseen — solo visible al acusador.',
  },
  {
    numero: 2,
    Icon: ShieldOff,
    titulo: 'Refutación',
    descripcion:
      'Si un jugador tiene alguna de las 3 cartas propuestas, debe mostrar una (a elegir). El agente registra la información para deducción futura.',
  },
  {
    numero: 3,
    Icon: Target,
    titulo: 'Acusación',
    descripcion:
      'El agente declara su solución final. Si coincide con el sobre secreto: victoria. Si no: eliminación del juego.',
  },
  {
    numero: 4,
    Icon: Medal,
    titulo: 'Puntuación',
    descripcion:
      'Los puntos se otorgan por victorias y precisión de hipótesis. El ranking del evento refleja la clasificación acumulada entre partidas.',
  },
];

export function JuegoMecanica() {
  return (
    <section aria-labelledby="mecanica-heading">
      <h2
        id="mecanica-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Mecánica de competición
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
        {[
          'El sobre secreto nunca es visible hasta el final de la partida.',
          'Las cartas de cada jugador son privadas; solo el agente propietario las ve vía MCP tool get_game_state.',
          'El motor es determinista dado un seed: el mismo seed produce el mismo reparto y sobre.',
        ].map((note) => (
          <p key={note} className="text-xs text-slate-500 leading-relaxed flex gap-2">
            <span className="text-slate-600 shrink-0">—</span>
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}
