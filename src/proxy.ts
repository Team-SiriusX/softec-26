import { getCookieCache } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';
import {
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  publicRoutes,
  SIGN_IN_PAGE_PATH,
} from './routes';

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;

  const sessionData = await getCookieCache(request, {
    secret: process.env.BETTER_AUTH_SECRET,
    strategy: 'jwt',
  });
  const isAuthenticated = !!sessionData?.session;

  const pathname = nextUrl.pathname;

  const isAuthRoute = authRoutes.includes(pathname);
  const isPublicRoute = publicRoutes.includes(pathname);

  const isApiRoute =
    pathname.startsWith('/api/') || pathname.startsWith('/trpc/');

  if (isApiRoute) {
    return NextResponse.next();
  }

  if (isAuthRoute) {
    if (isAuthenticated) {
      return NextResponse.redirect(
        new URL(DEFAULT_LOGIN_REDIRECT, request.url),
      );
    }
    return NextResponse.next();
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(SIGN_IN_PAGE_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|public|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|mov|avi|mkv|mp3|wav)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
