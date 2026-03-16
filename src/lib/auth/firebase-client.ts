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
import { getFirebaseAuthProviderId } from './firebase-provider';

let persistenceReady = false;

function requireEnv(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing Firebase configuration: ${name}`);
  }
  return trimmed;
}

function getFirebaseClientConfig(): FirebaseOptions {
  return {
    apiKey: requireEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: requireEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    appId: requireEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  };
}

export function getFirebaseClientApp() {
  return getApps().length > 0 ? getApp() : initializeApp(getFirebaseClientConfig());
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export async function ensureFirebaseClientPersistence() {
  if (persistenceReady || typeof window === 'undefined') return;

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
