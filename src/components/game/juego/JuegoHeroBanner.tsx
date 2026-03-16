import { getTranslations } from 'next-intl/server';

export async function JuegoHeroBanner() {
  const t = await getTranslations('juego');
  const pre = t('heroBannerTitlePre');
  const title = [pre, t('heroBannerTitleCyan'), t('heroBannerTitlePost')].filter(Boolean).join(' ');

  return (
    <section aria-label={t('heroBannerAriaLabel')}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/50"
        style={{ height: 260 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/game/banner.png"
          alt={t('heroBannerImageAlt', { title })}
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
            {t('heroBannerLabel')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {pre && <>{pre}{' '}</>}
            <span className="text-cyan-400">{t('heroBannerTitleCyan')}</span>{' '}
            {t('heroBannerTitlePost')}
          </h1>
          <p className="text-slate-400 text-base mt-2 max-w-md">
            {t('heroBannerTagline')}
          </p>
        </div>
      </div>
    </section>
  );
}
