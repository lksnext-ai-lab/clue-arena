import { ARMAS } from '@/types/domain';

const ARMA_EMOJI: Record<string, string> = {
  'Candelabro':    '🕯️',
  'Cuchillo':      '🔪',
  'Tubo de plomo': '🔩',
  'Revólver':      '🔫',
  'Cuerda':        '🪢',
  'Llave inglesa': '🔧',
};

export function JuegoArmas() {
  return (
    <section aria-labelledby="armas-heading">
      <h2
        id="armas-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Armas del crimen
      </h2>

      {/* Reference image */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/50 mb-5"
        style={{ height: 240 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/game/juego-armas.jpg"
          alt="Galería de armas posibles del caso"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      {/* Weapon cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ARMAS.map((arma) => (
          <div
            key={arma}
            className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 flex flex-col items-center text-center"
          >
            <span className="text-2xl" role="img" aria-label={arma}>
              {ARMA_EMOJI[arma] ?? '🗡️'}
            </span>
            <p className="text-xs font-semibold text-white mt-2 leading-tight">{arma}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Una de estas 6 armas figura en el sobre secreto. Las otras 5 están repartidas entre los jugadores.
      </p>
    </section>
  );
}
