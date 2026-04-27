// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const API_BASE = process.env.NEXTAUTH_API_URL ?? 'http://localhost:3000/api/v1';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  providers: [
    // ==========================================
    // EMAIL + SENHA
    // ==========================================
    CredentialsProvider({
      id:   'credentials',
      name: 'Email e Senha',
      credentials: {
        email:    { label: 'Email',  type: 'email' },
        password: { label: 'Senha', type: 'password' },
        tenant:   { label: 'Tenant Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Slug': credentials.tenant ?? 'demo',
          },
          body: JSON.stringify({
            email:    credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const { accessToken, refreshToken } = await res.json();

        // Buscar dados do usuário
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'X-Tenant-Slug': credentials.tenant ?? 'demo',
          },
        });

        if (!meRes.ok) return null;
        const user = await meRes.json();

        return {
          id:           user.id,
          name:         user.name,
          email:        user.email,
          role:         user.role,
          tenantId:     user.tenantId,
          tenantSlug:   credentials.tenant,
          accessToken,
          refreshToken,
        };
      },
    }),

    // ==========================================
    // GOOGLE OAUTH
    // ==========================================
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Login inicial — copiar dados do usuário para o token
      if (user) {
        token.id           = user.id;
        token.role         = (user as any).role;
        token.tenantId     = (user as any).tenantId;
        token.tenantSlug   = (user as any).tenantSlug;
        token.accessToken  = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
      }

      // Login via Google — trocar idToken pelo token do backend
      if (account?.provider === 'google' && account.id_token) {
        const tenantSlug = process.env.DEFAULT_TENANT_SLUG ?? 'demo';
        const res = await fetch(`${API_BASE}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Slug': tenantSlug,
          },
          body: JSON.stringify({ idToken: account.id_token }),
        });

        if (res.ok) {
          const { accessToken, refreshToken } = await res.json();
          token.accessToken  = accessToken;
          token.refreshToken = refreshToken;
          token.tenantSlug   = tenantSlug;
        }
      }

      return token;
    },

    async session({ session, token }) {
      (session as any).accessToken  = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      session.user = {
        ...session.user,
        id:         token.id as string,
        role:       token.role as string,
        tenantId:   token.tenantId as string,
        tenantSlug: token.tenantSlug as string,
      } as any;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
