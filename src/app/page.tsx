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

const heroOverview = [
  { key: 'overview01Title', body: 'overview01Desc', href: '/acerca-del-juego', Icon: Crosshair },
  { key: 'overview02Title', body: 'overview02Desc', href: '/instrucciones', Icon: Bot },
  { key: 'overview03Title', body: 'overview03Desc', href: '/arena', Icon: Radar },
] as const;

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
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-55"
          style={{ backgroundImage: "url('/fondo-inicio.webp')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_78%_12%,_rgba(251,191,36,0.16),_transparent_22%),radial-gradient(circle_at_72%_62%,_rgba(248,113,113,0.14),_transparent_24%),linear-gradient(180deg,_rgba(8,17,31,0.32)_0%,_rgba(7,17,31,0.62)_48%,_rgba(5,11,20,0.86)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[640px] bg-[linear-gradient(to_bottom,_rgba(8,17,31,0.04),_rgba(8,17,31,0.72))]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-screen-2xl items-start px-4 pb-12 pt-6 sm:px-6 lg:px-8 xl:pb-16 xl:pt-10">
        <div className="grid w-full gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-center xl:gap-12 2xl:gap-16">
          <div className="relative xl:pt-2">
            <Image src="/lks.svg" alt="LKS logo" width={64} height={64} priority className="h-14 w-14 sm:h-16 sm:w-16" />

            <div className="mt-6 max-w-3xl">
              <p className="text-sm uppercase tracking-[0.28em] text-amber-200/80">{t('kicker')}</p>
              <h1
                className="mt-4 text-4xl font-semibold leading-[0.92] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl 2xl:text-7xl"
                style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
              >
                {t('title')}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8 lg:text-xl">
                {t('subtitle')}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/instrucciones"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_30px_rgba(34,211,238,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 sm:w-auto"
              >
                {tInst('sec8Titulo')}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/acerca-del-juego"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-amber-200/40 hover:bg-white/10 sm:w-auto"
              >
                {tJuego('titulo')}
                <ArrowRight size={16} className="text-amber-200" />
              </Link>
            </div>

            <div className="mt-10 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_50px_rgba(2,8,23,0.22)] backdrop-blur-md sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/85">{t('overviewEyebrow')}</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{t('overviewTitle')}</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {heroOverview.map(({ key, body, href, Icon }, index) => (
                  <Link
                    key={key}
                    href={href}
                    className="group rounded-[24px] border border-white/8 bg-slate-950/35 p-4 transition-transform duration-200 hover:-translate-y-1 hover:border-cyan-300/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-cyan-200">
                        <Icon size={18} />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                        {t(`overviewStep0${index + 1}`)}
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">{t(key)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{t(body)}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
                      {t('overviewCta')}
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {heroMetrics.map((item) => (
                <article
                  key={item.key}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-md shadow-[0_20px_50px_rgba(2,8,23,0.25)]"
                >
                  <p className="whitespace-nowrap text-[1.8rem] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[2rem] lg:text-3xl">
                    {t(item.key)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{t(item.label)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative xl:sticky xl:top-6 xl:self-start">
            <div className="relative overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-2 shadow-[0_30px_90px_rgba(2,6,23,0.55)] sm:p-3">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_32%)]" />
              <div className="relative rounded-[30px] border border-white/10 bg-[#08111f]/90 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-sm">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">{t('visualEyebrow')}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{t('visualTitle')}</h2>
                  </div>
                </div>

                <div className="relative mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/80">
                  <div className="relative aspect-[16/11] w-full sm:aspect-[4/3] xl:aspect-[5/6]">
                    <Image
                      src="/home/signal-grid.svg"
                      alt={t('visualGridAlt')}
                      fill
                      priority
                      className="object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.02),rgba(6,11,19,0.38))]" />
                    <div className="absolute inset-x-4 top-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 backdrop-blur sm:inset-x-5 sm:top-5">
                      <p className="text-sm font-medium text-white">{t('panelTitle')}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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

              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {routes.map(({ href, title, body, Icon }, index) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 transition-transform duration-200 hover:-translate-y-1 sm:p-7"
            >
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-200">
                    <Icon size={22} />
                  </div>
                  <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                    {t(`routeStep0${index + 1}`)}
                  </span>
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

      <section className="relative mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 backdrop-blur-md sm:p-7">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/85">{t('timelineEyebrow')}</p>
            <h2
              className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              {t('timelineTitle')}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">{t('timelineDesc')}</p>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#08111f] p-3 sm:p-4">
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
              <article className="rounded-[28px] border border-cyan-300/18 bg-cyan-300/10 p-5 sm:p-6">
                <div className="flex items-center gap-3 text-cyan-100">
                  <Swords size={18} />
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]">{t('bottomCard01Eyebrow')}</p>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">{t('bottomCard01Title')}</h3>
                <p className="mt-3 text-sm leading-7 text-cyan-50/80">{t('bottomCard01Desc')}</p>
              </article>
              <article className="rounded-[28px] border border-amber-200/18 bg-amber-200/10 p-5 sm:p-6">
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
