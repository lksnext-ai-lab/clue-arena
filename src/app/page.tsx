import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  Bot,
  Crosshair,
  Eye,
  Fingerprint,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';

const heroMetrics = [
  { key: 'metric01Value', label: 'metric01Label' },
  { key: 'metric02Value', label: 'metric02Label' },
  { key: 'metric03Value', label: 'metric03Label' },
] as const;

const routes = [
  { href: '/acerca-del-juego', title: 'feature01Title', body: 'feature01Desc', Icon: Crosshair },
  { href: '/instrucciones', title: 'feature02Title', body: 'feature02Desc', Icon: Bot },
  { href: '/arena', title: 'feature03Title', body: 'feature03Desc', Icon: Radar },
] as const;

const steps = [
  { id: '01', title: 'step01Title', body: 'step01Desc' },
  { id: '02', title: 'step02Title', body: 'step02Desc' },
  { id: '03', title: 'step03Title', body: 'step03Desc' },
] as const;

const highlights = [
  { title: 'highlight01Title', body: 'highlight01Desc', Icon: ShieldCheck },
  { title: 'highlight02Title', body: 'highlight02Desc', Icon: Sparkles },
  { title: 'highlight03Title', body: 'highlight03Desc', Icon: Trophy },
] as const;

const evidenceCards = [
  { title: 'evidence01Title', label: 'evidence01Label', src: '/game/personajes/personaje-scarlett.webp' },
  { title: 'evidence02Title', label: 'evidence02Label', src: '/game/arma/arma-teclado.webp' },
  { title: 'evidence03Title', label: 'evidence03Label', src: '/game/escenarios/escenario-sala-servidores.webp' },
] as const;

const dossierSignals = [
  { title: 'signal01Title', body: 'signal01Desc', Icon: Eye },
  { title: 'signal02Title', body: 'signal02Desc', Icon: Fingerprint },
  { title: 'signal03Title', body: 'signal03Desc', Icon: Lock },
] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tInst = await getTranslations('instrucciones');
  const tJuego = await getTranslations('juego');

  return (
    <main className="relative overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),radial-gradient(circle_at_78%_12%,_rgba(251,191,36,0.18),_transparent_22%),radial-gradient(circle_at_72%_62%,_rgba(248,113,113,0.14),_transparent_24%),linear-gradient(180deg,_#08111f_0%,_#07111f_48%,_#050b14_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[640px] bg-[linear-gradient(to_bottom,_rgba(8,17,31,0.08),_rgba(8,17,31,0.92))]" />
      </div>

      <section className="relative mx-auto max-w-7xl px-6 pb-10 pt-8 sm:px-8 lg:px-10 lg:pb-14 lg:pt-10">
        <div className="grid gap-10 xl:grid-cols-[1.08fr_0.92fr] xl:items-center">
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
              {t('eyebrow')}
            </div>

            <div className="mt-6 max-w-3xl">
              <p className="text-sm uppercase tracking-[0.28em] text-amber-200/80">{t('kicker')}</p>
              <h1
                className="mt-4 text-5xl font-semibold leading-none tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
                style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
              >
                {t('title')}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                {t('subtitle')}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">{t('narrative')}</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/instrucciones"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_30px_rgba(34,211,238,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                {tInst('sec8Titulo')}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/acerca-del-juego"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-amber-200/40 hover:bg-white/10"
              >
                {tJuego('titulo')}
                <ArrowRight size={16} className="text-amber-200" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {heroMetrics.map((item) => (
                <article
                  key={item.key}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-md shadow-[0_20px_50px_rgba(2,8,23,0.25)]"
                >
                  <p className="text-3xl font-semibold tracking-[-0.04em] text-white">{t(item.key)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{t(item.label)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="landing-float absolute -left-6 top-8 hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/90 lg:inline-flex">
              {t('floatingBadge01')}
            </div>
            <div className="landing-float-delayed absolute -right-3 top-28 hidden rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-100/90 lg:inline-flex">
              {t('floatingBadge02')}
            </div>

            <div className="relative overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-3 shadow-[0_30px_90px_rgba(2,6,23,0.55)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_32%)]" />
              <div className="relative rounded-[30px] border border-white/10 bg-[#08111f]/90 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">{t('visualEyebrow')}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{t('visualTitle')}</h2>
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                    {t('visualBadge')}
                  </div>
                </div>

                <div className="relative mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/80 p-4">
                  <Image
                    src="/home/signal-grid.svg"
                    alt={t('visualGridAlt')}
                    width={720}
                    height={560}
                    className="h-auto w-full rounded-[22px] opacity-80"
                    priority
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.02),rgba(6,11,19,0.38))]" />
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 backdrop-blur">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{t('panelLabel')}</p>
                      <p className="mt-1 text-sm font-medium text-white">{t('panelTitle')}</p>
                    </div>
                    <div className="rounded-full border border-emerald-300/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                      {t('panelStatus')}
                    </div>
                  </div>
                  <div className="absolute bottom-5 left-5 max-w-[17rem] rounded-[24px] border border-white/10 bg-slate-950/74 p-4 backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/85">{t('calloutLabel')}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('calloutBody')}</p>
                  </div>
                  <div className="absolute bottom-5 right-5 hidden w-44 rounded-[24px] border border-white/10 bg-slate-950/74 p-3 backdrop-blur-sm md:block">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/85">{t('evidenceDeckLabel')}</p>
                    <div className="mt-3 space-y-2">
                      {evidenceCards.map((item) => (
                        <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-2">
                          <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/8 bg-slate-900/80">
                            <Image src={item.src} alt={t(item.title)} fill className="object-cover" sizes="48px" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{t(item.label)}</p>
                            <p className="truncate text-xs font-semibold text-white">{t(item.title)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {highlights.map(({ title, body, Icon }) => (
                    <article key={title} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-cyan-200">
                        <Icon size={18} />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-white">{t(title)}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{t(body)}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-white/8 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(255,255,255,0.04),rgba(251,191,36,0.12))] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                      {t('deductionStripLabel')}
                    </span>
                    {evidenceCards.map((item, index) => (
                      <div key={item.title} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/65 px-3 py-2">
                          <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/10 bg-slate-900">
                            <Image src={item.src} alt={t(item.title)} fill className="object-cover" sizes="28px" />
                          </div>
                          <span className="text-xs font-medium text-white">{t(item.title)}</span>
                        </div>
                        {index < evidenceCards.length - 1 ? (
                          <span className="text-cyan-200/70">
                            <ArrowRight size={14} />
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="grid gap-5 lg:grid-cols-3">
          {routes.map(({ href, title, body, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-7 transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-200">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{t(title)}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-slate-400">{t(body)}</p>
                <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
                  {t('routeCta')}
                  <ArrowRight size={15} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/6 p-7 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/85">{t('timelineEyebrow')}</p>
            <h2
              className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              {t('timelineTitle')}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">{t('timelineDesc')}</p>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#08111f] p-4">
              <Image
                src="/home/hero-dossier.svg"
                alt={t('timelineArtAlt')}
                width={720}
                height={720}
                className="h-auto w-full rounded-[22px]"
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {dossierSignals.map(({ title, body, Icon }) => (
                <article key={title} className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-cyan-200">
                    <Icon size={18} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{t(title)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{t(body)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {steps.map((step) => (
              <article
                key={step.id}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 backdrop-blur-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-lg font-semibold tracking-[0.16em] text-amber-100">
                    {step.id}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{t(step.title)}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{t(step.body)}</p>
                  </div>
                </div>
              </article>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[28px] border border-cyan-300/18 bg-cyan-300/10 p-6">
                <div className="flex items-center gap-3 text-cyan-100">
                  <Swords size={18} />
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]">{t('bottomCard01Eyebrow')}</p>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">{t('bottomCard01Title')}</h3>
                <p className="mt-3 text-sm leading-7 text-cyan-50/80">{t('bottomCard01Desc')}</p>
              </article>
              <article className="rounded-[28px] border border-amber-200/18 bg-amber-200/10 p-6">
                <div className="flex items-center gap-3 text-amber-100">
                  <Trophy size={18} />
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]">{t('bottomCard02Eyebrow')}</p>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">{t('bottomCard02Title')}</h3>
                <p className="mt-3 text-sm leading-7 text-amber-50/85">{t('bottomCard02Desc')}</p>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
