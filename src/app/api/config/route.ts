import { NextResponse } from 'next/server';

const PUBLIC_KEYS = [
  'NEXT_PUBLIC_DISABLE_AUTH',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_WS_URL',
  'NEXT_PUBLIC_APP_VERSION',
];

export function GET() {
  const payload: Record<string, string> = {};

  for (const key of PUBLIC_KEYS) {
    const value = process.env[key] ?? '';
    if (value) payload[key] = value;
  }

  return NextResponse.json(payload);
}
