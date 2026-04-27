// src/types/next-auth.d.ts
// Extende os tipos do NextAuth com campos custom do backend

import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken:  string;
    refreshToken: string;
    user: {
      id:         string;
      role:       string;
      tenantId:   string;
      tenantSlug: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role:         string;
    tenantId:     string;
    tenantSlug:   string;
    accessToken:  string;
    refreshToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:           string;
    role:         string;
    tenantId:     string;
    tenantSlug:   string;
    accessToken:  string;
    refreshToken: string;
  }
}
