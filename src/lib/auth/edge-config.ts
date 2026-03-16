/**
 * Auth.js configuration for Edge Runtime (middleware).
 * Must NOT import any Node.js-only modules (no DB, no better-sqlite3).
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { FIREBASE_AUTH_PROVIDER_ID, applyAppUserToToken, applyTokenToSession } from './auth-shared';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      id: FIREBASE_AUTH_PROVIDER_ID,
      name: 'Firebase',
      credentials: {
        idToken: { label: 'Firebase ID token', type: 'text' },
      },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      return user ? applyAppUserToToken(token, user) : token;
    },
    async session({ session, token }) {
      return applyTokenToSession(session, token);
    },
  },
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
