
import { signIn, auth } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import DevLoginButtons from './DevLoginButtons';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

/**
 * UI-001 — Login / Landing
 * Public page. Shows the OIDC login button.
 * When DISABLE_AUTH=true, also shows dev role shortcuts.
 * If a session already exists, redirects to the callbackUrl or the default dashboard.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const devMode = isAuthDisabled();
  const t = await getTranslations('auth');
  const session = await auth();

  if (session?.user) {
    const callbackUrl = searchParams?.callbackUrl as string | undefined;
    const defaultUrl = session.user.rol === 'admin' ? '/admin' : '/dashboard';
    redirect(callbackUrl ?? defaultUrl);
  }

  return (
    <main className="dark min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-8 px-6">
        {/* Event title */}
        <div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-wide text-cyan-400 font-serif"
          >
            Clue Arena
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            El Algoritmo Asesinado
          </p>
        </div>

        <p className="text-sm max-w-sm mx-auto text-slate-500">
          {t('descripcionLogin')}
        </p>

        {/* OIDC login button */}
        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: searchParams?.callbackUrl as string || '/' });
          }}
        >
          <button
            type="submit"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 bg-cyan-500 text-slate-900 hover:bg-cyan-400"
          >
            {t('iniciarSesionMicrosoft')}
          </button>
        </form>

        {/* Dev-mode role selector */}
        {devMode && <DevLoginButtons />}
      </div>
    </main>
  );
}
