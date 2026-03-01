import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function JuegoQueEsCluedo() {
  const t = await getTranslations('juego');
  return (
    <section aria-labelledby="cluedo-heading">
      <h2
        id="cluedo-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        {t('queEsHeading')}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Text column */}
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            {t.rich('queEsP1', {
              bold: (chunks) => <strong className="text-white">{chunks}</strong>,
              em: (chunks) => <em>{chunks}</em>,
              cyan: (chunks) => <span className="text-cyan-300 font-medium">{chunks}</span>,
            })}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t.rich('queEsP2', {
              bold: (chunks) => <strong className="text-white">{chunks}</strong>,
              em: (chunks) => <em>{chunks}</em>,
              code: (chunks) => (
                <code className="text-cyan-400 bg-slate-800 px-1 rounded text-xs">{chunks}</code>
              ),
            })}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t.rich('queEsP3', {
              bold: (chunks) => <strong className="text-white">{chunks}</strong>,
              em: (chunks) => <em>{chunks}</em>,
            })}
          </p>
          <div className="bg-slate-800/60 border border-cyan-500/20 rounded-lg p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-cyan-400 font-semibold">{t('queEsInfoboxLabel')}</span>{' '}
              {t('queEsInfobox')}
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
