
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider as NextAuthProvider } from 'next-auth/react';
import { SessionProvider } from '@/contexts/SessionContext';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { RootShell } from '@/components/layout/RootShell';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    title: t('appTitle'),
    description: t('appDescription'),
    icons: {
      icon: [
        { url: '/clue-favico.png', type: 'image/png', sizes: '512x512' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <NextAuthProvider>
            <SessionProvider>
              <RootShell>{children}</RootShell>
            </SessionProvider>
          </NextAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
