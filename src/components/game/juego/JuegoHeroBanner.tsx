export function JuegoHeroBanner() {
  return (
    <section aria-label="Banner del evento">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/50"
        style={{ height: 260 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/game/juego-hero.jpg"
          alt="Banner del evento Clue Arena — El Algoritmo Asesinado"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        {/* Gradient overlay left → transparent */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.55) 45%, transparent 100%)',
          }}
        />
        {/* Text content */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-2">
            Challenge corporativo · Mayo 2026
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            El{' '}
            <span className="text-cyan-400">Algoritmo</span>{' '}
            Asesinado
          </h1>
          <p className="text-slate-400 text-base mt-2 max-w-md">
            Construye un agente IA capaz de resolver el crimen antes que nadie.
            Estrategia, deducción y código.
          </p>
        </div>
      </div>
    </section>
  );
}
