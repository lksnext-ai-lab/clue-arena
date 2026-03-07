
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider as NextAuthProvider } from 'next-auth/react';
import { SessionProvider } from '@/contexts/SessionContext';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { RootShell } from '@/components/layout/RootShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Clue Arena — El Algoritmo Asesinado',
  description: 'Plataforma de competición gamificada con agentes IA jugando al Cluedo',
};

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
