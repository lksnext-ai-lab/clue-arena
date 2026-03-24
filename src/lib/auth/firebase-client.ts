import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  FacebookAuthProvider,
  GithubAuthProvider,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  OAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  TwitterAuthProvider,
} from 'firebase/auth';
import { fetchRuntimeConfig, hasStaticFirebaseConfig, getStaticConfig } from '@/lib/runtime-config';
import { getFirebaseAuthProviderId } from './firebase-provider';

let persistenceReady = false;

async function getFirebaseClientConfig(): Promise<FirebaseOptions> {
  const staticConfig = getStaticConfig();

  if (hasStaticFirebaseConfig(staticConfig)) {
    return {
      apiKey: staticConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: staticConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: staticConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: staticConfig.NEXT_PUBLIC_FIREBASE_APP_ID,
      messagingSenderId: staticConfig.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
      storageBucket: staticConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    };
  }

  // Build-time vars were empty (CI/K8s): load from the running pod's env via /api/config.
  const cfg = await fetchRuntimeConfig();

  if (!cfg.NEXT_PUBLIC_FIREBASE_API_KEY || !cfg.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      !cfg.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !cfg.NEXT_PUBLIC_FIREBASE_APP_ID) {
    throw new Error(
      'Missing Firebase configuration. Ensure NEXT_PUBLIC_FIREBASE_API_KEY, ' +
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID and ' +
      'NEXT_PUBLIC_FIREBASE_APP_ID are set in the environment.',
    );
  }

  return {
    apiKey: cfg.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: cfg.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: cfg.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: cfg.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: cfg.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
    storageBucket: cfg.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
  };
}

export async function initializeFirebaseClient(): Promise<void> {
  if (getApps().length > 0) return;

  const config = await getFirebaseClientConfig();
  initializeApp(config);
}

export function getFirebaseClientApp() {
  if (getApps().length > 0) return getApp();
  throw new Error('Firebase client has not been initialized. Use initializeFirebaseClient() first.');
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export async function ensureFirebaseClientPersistence() {
  if (persistenceReady || typeof window === 'undefined') return;

  await initializeFirebaseClient();

  const auth = getFirebaseClientAuth();

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    await setPersistence(auth, inMemoryPersistence);
  }

  persistenceReady = true;
}

export function createFirebaseAuthProvider(providerId = getFirebaseAuthProviderId()) {
  if (providerId === 'password') {
    throw new Error('Password sign-in does not use an OAuth provider instance');
  }

  if (providerId === 'google.com') {
    return new GoogleAuthProvider();
  }

  if (providerId === 'github.com') {
    return new GithubAuthProvider();
  }

  if (providerId === 'facebook.com') {
    return new FacebookAuthProvider();
  }

  if (providerId === 'twitter.com') {
    return new TwitterAuthProvider();
  }

  return new OAuthProvider(providerId);
}

export { signInWithEmailAndPassword };
