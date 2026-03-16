import Image from 'next/image';
import { Bot, Search, Trophy } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function JuegoQueEsCluedo() {
  const t = await getTranslations('juego');
  const highlights = [
    {
      Icon: Search,
      title: t('queEsHighlight01Title'),
      description: t('queEsHighlight01Desc'),
    },
    {
      Icon: Trophy,
      title: t('queEsHighlight02Title'),
      description: t('queEsHighlight02Desc'),
    },
    {
      Icon: Bot,
      title: t('queEsHighlight03Title'),
      description: t('queEsHighlight03Desc'),
    },
  ];

  return (
    <section aria-labelledby="cluedo-heading" className="relative">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.14),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] shadow-[0_26px_70px_rgba(2,6,23,0.32)]">
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:p-8 xl:p-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">
                {t('queEsEyebrow')}
              </p>
              <div className="space-y-3">
                <h2 id="cluedo-heading" className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  {t('queEsTitle')}
                </h2>
                <p className="max-w-2xl text-base leading-8 text-slate-300">
                  {t.rich('queEsLead', {
                    bold: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
                    cyan: (chunks) => <span className="font-semibold text-cyan-300">{chunks}</span>,
                    em: (chunks) => <em className="text-slate-100">{chunks}</em>,
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map(({ Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                </article>
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/80">
                {t('queEsStoryLabel')}
              </p>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-7 text-slate-300">
                  {t.rich('queEsP1', {
                    bold: (chunks) => <strong className="text-white">{chunks}</strong>,
                    em: (chunks) => <em>{chunks}</em>,
                    cyan: (chunks) => <span className="font-medium text-cyan-300">{chunks}</span>,
                  })}
                </p>
                <p className="text-sm leading-7 text-slate-300">
                  {t.rich('queEsP2', {
                    bold: (chunks) => <strong className="text-white">{chunks}</strong>,
                    em: (chunks) => <em>{chunks}</em>,
                    code: (chunks) => (
                      <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-300">
                        {chunks}
                      </code>
                    ),
                  })}
                </p>
                <p className="text-sm leading-7 text-slate-300">
                  {t.rich('queEsP3', {
                    bold: (chunks) => <strong className="text-white">{chunks}</strong>,
                    em: (chunks) => <em>{chunks}</em>,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/50">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <Image
                src="/game/escena.webp"
                alt={t('queEsImageAlt')}
                width={800}
                height={960}
                quality={80}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="h-full min-h-[320px] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/80">
                  {t('queEsImageLabel')}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-200">
                  {t('queEsImageCaption')}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {t('queEsFlowLabel')}
              </p>
              <div className="mt-4 space-y-3">
                {(['01', '02', '03'] as const).map((step) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/35 p-3"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-xs font-semibold text-amber-200">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{t(`queEsFlow${step}Title`)}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{t(`queEsFlow${step}Desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/6 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                {t('queEsInfoboxLabel')}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{t('queEsInfobox')}</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
