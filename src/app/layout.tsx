import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider as NextAuthProvider } from 'next-auth/react';
import { SessionProvider } from '@/contexts/SessionContext';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

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
      <body className={inter.className} style={{ background: '#0a0a0f', color: '#f1f5f9' }}>
        <NextIntlClientProvider messages={messages}>
          <NextAuthProvider>
            <SessionProvider>
              {children}
            </SessionProvider>
          </NextAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
