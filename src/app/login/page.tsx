import Image from 'next/image';
import { BadgeCheck, Building2, LockKeyhole, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import { getFirebaseAuthOptions } from '@/lib/auth/firebase-auth-options';
import { getDemoUsers } from '@/lib/auth/user-profile';
import DevLoginButtons from './DevLoginButtons';
import FirebaseLoginButton from './FirebaseLoginButton';

/**
 * UI-001 — Login / Landing
 * Public page. Shows the Firebase login button.
 * When DISABLE_AUTH=true, also shows dev role shortcuts.
 * If a session already exists, redirects to the callbackUrl or the default dashboard.
 */
type NextPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const trustSignals = [
  { key: 'featureSecure', Icon: LockKeyhole },
  { key: 'featureCorporate', Icon: Building2 },
  { key: 'featureExperience', Icon: Sparkles },
] as const;

export default async function LoginPage({ searchParams }: NextPageProps) {
  const devMode = isAuthDisabled();
  const t = await getTranslations('auth');
  const session = await auth();
  const floatingBadge = t('floatingBadge');
  const authOptions = await getFirebaseAuthOptions();
  const providerSummary = authOptions.map((option) => option.label).join(' · ');
  const demoUsers = await getDemoUsers();

  const params = (await searchParams) ?? {};
  const callbackUrl = typeof params.callbackUrl === 'string' ? params.callbackUrl : undefined;

  if (session?.user) {
    const defaultUrl = session.user.rol === 'admin' ? '/admin' : '/dashboard';
    redirect(callbackUrl ?? defaultUrl);
  }

  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#050b14] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/fondo-login.webp')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_78%_14%,_rgba(251,191,36,0.14),_transparent_20%),radial-gradient(circle_at_50%_85%,_rgba(248,113,113,0.12),_transparent_24%),linear-gradient(180deg,_rgba(8,17,31,0.66)_0%,_rgba(5,11,20,0.88)_100%)]" />
        <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10 sm:px-8 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="max-w-2xl">
            <Image src="/lks.svg" alt="LKS logo" width={64} height={64} priority className="h-16 w-auto" />

            <p className="mt-8 text-sm uppercase tracking-[0.28em] text-amber-200/80">{t('kicker')}</p>
            <h1
              className="mt-4 text-5xl font-semibold leading-none tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              Clue Arena
            </h1>
            <p className="mt-4 text-xl text-slate-200 sm:text-2xl">{t('caseName')}</p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{t('descripcionLogin')}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {trustSignals.map(({ key, Icon }) => (
                <article
                  key={key}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-md shadow-[0_20px_50px_rgba(2,8,23,0.25)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-200">
                    <Icon size={18} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{t(`${key}Title`)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{t(`${key}Desc`)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="relative">
            {floatingBadge ? (
              <div className="absolute -left-6 top-10 hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/90 lg:inline-flex">
                {floatingBadge}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-3 shadow-[0_30px_90px_rgba(2,6,23,0.55)]">
              <div className="rounded-[28px] border border-white/10 bg-[#08111f]/90 p-6 sm:p-8">
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">{t('panelTitle')}</h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-400">{t('panelDescription')}</p>
                </div>

                <div className="mt-8 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(8,17,31,0.94))] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                      <BadgeCheck size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t('loginMethodTitle')}</p>
                      <p className="text-sm text-slate-400">{t('loginMethodDesc', { providers: providerSummary })}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {authOptions.map((option) => (
                      <span
                        key={option.id}
                        className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-slate-300"
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6">
                    <FirebaseLoginButton callbackUrl={callbackUrl} options={authOptions} demoUsers={demoUsers} />
                  </div>
                </div>

                {devMode && <DevLoginButtons />}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
