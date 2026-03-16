import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { FIREBASE_AUTH_PROVIDER_ID, applyAppUserToToken, applyTokenToSession } from './auth-shared';
import { verifyFirebaseIdToken } from './firebase-admin';
import { ensureAppAuthUser, getAppAuthUserByEmail } from './user-profile';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: FIREBASE_AUTH_PROVIDER_ID,
      name: 'Firebase',
      credentials: {
        idToken: { label: 'Firebase ID token', type: 'text' },
      },
      async authorize(credentials) {
        const idToken = credentials?.idToken;
        if (typeof idToken !== 'string' || idToken.length === 0) {
          return null;
        }

        try {
          const decodedToken = await verifyFirebaseIdToken(idToken);
          const email = decodedToken.email?.trim().toLowerCase();

          if (!decodedToken.email_verified || !email) {
            return null;
          }

          return ensureAppAuthUser({
            email,
            name: decodedToken.name ?? decodedToken.email ?? email,
          });
        } catch (error) {
          console.error('> [auth] Firebase sign-in failed:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return applyAppUserToToken(token, user);
      }

      if (typeof token.email === 'string' && token.email.length > 0) {
        const appUser = await getAppAuthUserByEmail(token.email);
        if (appUser) {
          return applyAppUserToToken(token, appUser);
        }
      }

      return token;
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
