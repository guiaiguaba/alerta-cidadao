// src/middleware.ts
// Protege todas as rotas /dashboard — redireciona para /login se não autenticado

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token as any;
    const pathname = req.nextUrl.pathname;

    // Cidadãos não têm acesso ao painel
    if (token?.role === 'citizen' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login?error=AccessDenied', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
);

export const config = {
  matcher: ['/dashboard/:path*'],
};
