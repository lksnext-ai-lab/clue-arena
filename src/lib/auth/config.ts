import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      rol: 'admin' | 'equipo' | 'espectador' | null;
      equipo: { id: string; nombre: string; agentId: string } | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.ENTRA_CLIENT_ID!,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Upsert usuario en BD local en primer login
      const existing = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, user.email))
        .get();

      if (!existing) {
        const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
        const isBootstrapAdmin =
          Boolean(bootstrapEmail) && user.email.toLowerCase() === bootstrapEmail;

        await db
          .insert(usuarios)
          .values({
            id: uuidv4(),
            email: user.email,
            nombre: user.name ?? user.email,
            rol: isBootstrapAdmin ? 'admin' : 'espectador',
            createdAt: new Date(),
          })
          .onConflictDoNothing();
      }

      return true;
    },
    async session({ session, token: _token }) {
      if (!session.user?.email) return session;

      // Enriquecer sesión con rol y equipo desde BD
      const dbUser = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, session.user.email))
        .get();

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.rol = dbUser.rol;
        // equipo se resuelve en el callback session si es necesario
        session.user.equipo = null;
      }

      return session;
    },
  },
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
