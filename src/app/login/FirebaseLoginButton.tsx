'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, FlaskConical, KeyRound, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { getRedirectResult, signInWithPopup, signInWithRedirect, type User } from 'firebase/auth';
import {
  createFirebaseAuthProvider,
  ensureFirebaseClientPersistence,
  getFirebaseClientAuth,
  signInWithEmailAndPassword,
} from '@/lib/auth/firebase-client';
import { DEMO_PASSWORD } from '@/lib/auth/demo';

type FirebaseLoginOption = {
  id: string;
  kind: 'password' | 'oauth' | 'oidc' | 'saml';
  label: string;
};

type DemoUser = {
  email: string;
  nombre: string;
  rol: 'admin' | 'equipo' | 'espectador';
};

type FirebaseLoginButtonProps = {
  callbackUrl?: string;
  options: FirebaseLoginOption[];
  demoUsers?: DemoUser[];
};

function shouldFallbackToRedirect(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;

  return [
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/web-storage-unsupported',
  ].includes(String(error.code));
}

async function exchangeFirebaseSession(user: User, callbackUrl?: string) {
  const idToken = await user.getIdToken(true);
  const result = await signIn('firebase', {
    idToken,
    callbackUrl: callbackUrl ?? '/',
    redirect: false,
  });

  if (!result || result.error) {
    throw new Error(result?.error || 'firebase_session_exchange_failed');
  }

  window.location.assign(result.url ?? callbackUrl ?? '/');
}

const ROL_BADGE: Record<DemoUser['rol'], string> = {
  admin: 'bg-amber-300/15 text-amber-200 border-amber-300/20',
  equipo: 'bg-cyan-300/15 text-cyan-200 border-cyan-300/20',
  espectador: 'bg-slate-300/10 text-slate-300 border-slate-300/15',
};

export default function FirebaseLoginButton({
  callbackUrl,
  options,
  demoUsers = [],
}: FirebaseLoginButtonProps) {
  const t = useTranslations('auth');
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordOption = options.find((option) => option.kind === 'password');
  const providerOptions = options.filter((option) => option.kind !== 'password');
  const isLoading = activeOptionId !== null;

  useEffect(() => {
    let cancelled = false;

    async function resumeRedirectLogin() {
      try {
        await ensureFirebaseClientPersistence();
        const result = await getRedirectResult(getFirebaseClientAuth());
        if (!result?.user || cancelled) return;

        setActiveOptionId('redirect');
        await exchangeFirebaseSession(result.user, callbackUrl);
      } catch (error) {
        console.error('[FirebaseLoginButton] Redirect result failed:', error);
        if (!cancelled) {
          setError(t('errorLogin'));
          setActiveOptionId(null);
        }
      }
    }

    void resumeRedirectLogin();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, t]);

  async function handleProviderLogin(providerId: string) {
    setActiveOptionId(providerId);
    setError(null);

    try {
      await ensureFirebaseClientPersistence();
      const auth = getFirebaseClientAuth();
      const provider = createFirebaseAuthProvider(providerId);

      try {
        const result = await signInWithPopup(auth, provider);
        await exchangeFirebaseSession(result.user, callbackUrl);
      } catch (error) {
        if (shouldFallbackToRedirect(error)) {
          await signInWithRedirect(auth, provider);
          return;
        }

        throw error;
      }
    } catch (error) {
      console.error('[FirebaseLoginButton] Provider sign-in failed:', error);
      setError(t('errorLogin'));
      setActiveOptionId(null);
    }
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError(t('emailPasswordRequired'));
      return;
    }

    setActiveOptionId('password');
    setError(null);

    try {
      await ensureFirebaseClientPersistence();
      const auth = getFirebaseClientAuth();
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await exchangeFirebaseSession(result.user, callbackUrl);
    } catch (error) {
      console.error('[FirebaseLoginButton] Email/password sign-in failed:', error);
      setError(t('errorLogin'));
      setActiveOptionId(null);
    }
  }

  return (
    <div className="space-y-3">
      {passwordOption ? (
        <form className="space-y-3" onSubmit={(event) => void handlePasswordLogin(event)}>
          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <Mail size={14} />
              {t('emailLabel')}
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <KeyRound size={14} />
              {t('passwordLabel')}
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              placeholder={t('passwordPlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-300 px-5 py-4 text-sm font-semibold text-slate-950 shadow-[0_16px_35px_rgba(34,211,238,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span>{activeOptionId === 'password' ? t('iniciandoSesion') : t('signInWithPassword')}</span>
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </form>
      ) : null}

      {passwordOption && providerOptions.length > 0 ? (
        <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          <span>{t('orContinueWith')}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}

      {providerOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => {
            void handleProviderLogin(option.id);
          }}
          disabled={isLoading}
          className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-80"
        >
          <span>
            {activeOptionId === option.id ? t('iniciandoSesion') : t('continueWithProvider', { provider: option.label })}
          </span>
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      ))}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {demoUsers.length > 0 ? (
        <div className="mt-5 rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(15,23,42,0.30))] p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
            <FlaskConical size={12} />
            Demo accounts
          </p>
          <ul className="mt-3 space-y-2">
            {demoUsers.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-left transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{u.nombre}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROL_BADGE[u.rol]}`}
                  >
                    {u.rol}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            Pulsa para rellenar el acceso. Todas usan la contraseña <code>sample</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
