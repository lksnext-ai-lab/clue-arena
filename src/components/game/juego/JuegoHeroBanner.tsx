import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function JuegoHeroBanner() {
  const t = await getTranslations('juego');
  const pre = t('heroBannerTitlePre');
  const title = [pre, t('heroBannerTitleCyan'), t('heroBannerTitlePost')].filter(Boolean).join(' ');

  return (
    <section aria-label={t('heroBannerAriaLabel')}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-slate-700/50 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:rounded-[1.75rem]"
        style={{ minHeight: 280 }}
      >
        <Image
          src="/game/banner.webp"
          alt={t('heroBannerImageAlt', { title })}
          fill
          priority
          quality={85}
          sizes="(max-width: 768px) 100vw, 1280px"
          className="object-cover object-top"
        />
        {/* Gradient overlay left → transparent */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.62)_42%,rgba(2,6,23,0.16)_100%)] sm:bg-[linear-gradient(90deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.55)_46%,transparent_100%)]" />
        <div className="absolute inset-0 flex items-end sm:items-center">
          <div className="max-w-2xl px-5 py-6 sm:px-8 sm:py-10 lg:px-12">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300 sm:mb-3">
            {t('heroBannerLabel')}
            </p>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              {pre && <>{pre}{' '}</>}
              <span className="text-cyan-300">{t('heroBannerTitleCyan')}</span>{' '}
              {t('heroBannerTitlePost')}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              {t('heroBannerTagline')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
