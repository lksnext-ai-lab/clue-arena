
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function LandingPage() {
  const t_inst = await getTranslations('instrucciones');
  const t_juego = await getTranslations('juego');
  return (
    <div className="container mx-auto flex h-full flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
        {t_juego('subtitulo')}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        {t_inst('heroBannerDesc')}
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          href="/instrucciones"
          className="rounded-md bg-cyan-500 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        >
          {t_inst('sec8Titulo')}
        </Link>
        <Link href="/acerca-del-juego" className="text-sm font-semibold leading-6 text-slate-300">
          {t_juego('titulo')} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
