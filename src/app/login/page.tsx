import { signIn } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import DevLoginButtons from './DevLoginButtons';
import { getTranslations } from 'next-intl/server';

/**
 * UI-001 — Login / Landing
 * Public page. Shows the OIDC login button.
 * When DISABLE_AUTH=true, also shows dev role shortcuts.
 */
export default async function LoginPage() {
  const devMode = isAuthDisabled();
  const t = await getTranslations('auth');

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div className="text-center space-y-8 px-6">
        {/* Event title */}
        <div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-wide"
            style={{ color: '#f59e0b', fontFamily: 'Georgia, serif' }}
          >
            Clue Arena
          </h1>
          <p className="mt-2 text-lg" style={{ color: '#94a3b8' }}>
            El Algoritmo Asesinado
          </p>
        </div>

        <p className="text-sm max-w-sm mx-auto" style={{ color: '#64748b' }}>
          {t('descripcionLogin')}
        </p>

        {/* OIDC login button */}
        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: '#f59e0b', color: '#0a0a0f' }}
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
