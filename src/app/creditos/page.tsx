import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Creditos — Clue Arena',
  description: 'Pagina de creditos de Clue Arena.',
};

function Caption({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex w-fit border-[3px] border-black bg-[#ffe7a3] px-3 py-1 text-sm font-black uppercase tracking-[0.04em] text-black shadow-[4px_4px_0_#000] ${className}`}
      style={{ fontFamily: 'Arial Black, Impact, sans-serif' }}
    >
      {children}
    </div>
  );
}

function Note({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex max-w-sm border-[3px] border-black bg-[#fff6dc] px-4 py-3 text-base font-semibold italic leading-6 text-black shadow-[6px_6px_0_#000] ${className}`}
      style={{ fontFamily: 'Trebuchet MS, Arial, sans-serif' }}
    >
      {children}
    </div>
  );
}

function ComicPanel({
  image,
  className,
  imageClassName = '',
  children,
}: {
  image: string;
  className: string;
  imageClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`relative overflow-hidden border-[6px] border-black bg-[#12202c] ${className}`}>
      <div
        className={`absolute inset-0 bg-cover bg-no-repeat ${imageClassName}`}
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,22,0.12)_0%,rgba(9,14,22,0.32)_35%,rgba(9,14,22,0.74)_100%)]" />
      <div className="relative h-full p-4 sm:p-5">{children}</div>
    </article>
  );
}

export default function CreditosPage() {
  return (
    <main className="min-h-screen bg-[#05070b] px-3 py-3 text-white sm:px-4 sm:py-4">
      <div className="mx-auto max-w-[1380px]">
        <section className="grid gap-3 lg:grid-cols-12">
            <ComicPanel
              image="/fondo-inicio.png"
              className="min-h-[320px] lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:min-h-[360px]"
              imageClassName="bg-center"
            >
              <div className="flex h-full flex-col justify-between">
                <Caption>Conoce el caso.</Caption>
                <div />
                <Note className="max-w-[16rem]">
                  Los graficos han sido realizados por &quot;Nano Banana 2&quot;.
                </Note>
              </div>
            </ComicPanel>

            <ComicPanel
              image="/fondo-train.png"
              className="min-h-[320px] lg:col-span-4 lg:col-start-5 lg:row-start-1 lg:min-h-[360px]"
              imageClassName="bg-center"
            >
              <div className="flex h-full flex-col justify-between">
                <Caption>Construye tu equipo.</Caption>
                <div />
                <div />
              </div>
            </ComicPanel>

            <ComicPanel
              image="/fondo-partida.png"
              className="min-h-[360px] lg:col-span-6 lg:col-start-1 lg:row-start-2 lg:min-h-[420px]"
              imageClassName="bg-center"
            >
              <div className="flex h-full flex-col justify-between">
                <Caption>Entra en la arena.</Caption>
                <div />
                <div />
              </div>
            </ComicPanel>

            <ComicPanel
              image="/fondo-torneo.png"
              className="min-h-[360px] lg:col-span-6 lg:col-start-7 lg:row-start-2 lg:min-h-[420px]"
              imageClassName="bg-center"
            >
              <div className="flex h-full flex-col justify-between">
                <Caption>Compite y gana.</Caption>
                <div />
                <div className="flex items-end justify-between gap-4">
                  <Note className="max-w-[18rem]">
                    Programacion integra por &quot;Github Copilot&quot; usando &quot;Claude Sonnet 4.6&quot; y Codex con &quot;GPT 5.4&quot;.
                  </Note>
                  <div />
                </div>
              </div>
            </ComicPanel>

            <ComicPanel
              image="/fondo-ranking.png"
              className="min-h-[320px] lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:min-h-[360px]"
              imageClassName="bg-center"
            >
              <div className="flex h-full flex-col justify-between sm:flex-row sm:items-end">
                <Caption className="rotate-[-1deg]">Final.</Caption>
                <div />
              </div>
            </ComicPanel>
        </section>
      </div>
    </main>
  );
}
