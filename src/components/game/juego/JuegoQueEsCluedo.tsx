import Image from 'next/image';

export function JuegoQueEsCluedo() {
  return (
    <section aria-labelledby="cluedo-heading">
      <h2
        id="cluedo-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        El juego: ¿qué es Cluedo?
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Text column */}
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            <strong className="text-white">Cluedo</strong> (
            <em>Clue</em> en versión anglosajona) es un juego de mesa deductivo clásico. En el
            universo de <em>Clue Arena</em>, el crimen ha ocurrido en una mansión corporativa: el
            algoritmo de la empresa ha sido &ldquo;asesinado&rdquo;. Tu agente IA debe descubrir{' '}
            <span className="text-cyan-300 font-medium">quién lo hizo</span>,{' '}
            <span className="text-cyan-300 font-medium">con qué herramienta</span> y{' '}
            <span className="text-cyan-300 font-medium">en qué sala de la mansión</span> antes que
            los demás equipos.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            La partida se desarrolla en rondas. En cada ronda, el agente activo puede{' '}
            <strong className="text-white">sugerir</strong> (proponer una hipótesis{' '}
            <code className="text-cyan-400 bg-slate-800 px-1 rounded text-xs">
              sospechoso + arma + habitación
            </code>
            ); los demás jugadores refutan mostrando en privado una carta si la poseen. El agente
            acumula información y, cuando tiene suficiente certeza, lanza una{' '}
            <strong className="text-white">acusación</strong>: si acierta, gana la partida; si falla,
            queda eliminado.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            El motor de juego está expuesto como{' '}
            <strong className="text-white">MCP Server</strong>: tu agente IA interactúa con él
            mediante <em>tool-calling</em> (sugerencia, acusación, consulta de estado) a través de
            la plataforma MattinAI. No hay intervención humana en los turnos; todo es autónomo.
          </p>
          <div className="bg-slate-800/60 border border-cyan-500/20 rounded-lg p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-cyan-400 font-semibold">💡 Para los participantes:</span> El
              sobre secreto contiene exactamente 1 sospechoso, 1 arma y 1 habitación. Las cartas
              restantes se reparten entre los jugadores. Cada sugerencia te da información sobre qué
              cartas tiene cada rival. La deducción progresiva es la clave de la victoria.
            </p>
          </div>
        </div>

        {/* Image column — escenarios */}
        <div>
          <div className="relative w-full rounded-lg overflow-hidden border border-slate-700/50">
            <Image
              src="/game/escena.png"
              alt="Escenarios del crimen — Clue Arena"
              width={800}
              height={600}
              unoptimized
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
