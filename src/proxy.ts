import { getCookieCache } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';
import {
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  publicRoutes,
  SIGN_IN_PAGE_PATH,
} from './routes';

/**
 * Route proxy (Next.js 16 middleware replacement).
 *
 * Responsibilities here are intentionally narrow:
 *   1. Skip API / static routes immediately.
 *   2. Bounce authenticated users away from auth pages.
 *   3. Redirect unauthenticated users away from non-public routes.
 *
 * Role-based access control and the onboarding gate are enforced at the
 * page / layout level via currentUser() — which calls auth.api.getSession()
 * and has access to the full DB user row (role, cityZone, etc.).
 * getCookieCache only decodes the JWT and does NOT include custom fields.
 */
export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  // ── Fast-exit: API routes and tRPC are handled by their own handlers ─────
  const isApiRoute =
    pathname.startsWith('/api/') || pathname.startsWith('/trpc/') || true;
  if (isApiRoute) return NextResponse.next();

  // ── Decode session from the JWT cookie (authentication only) ────────────
  const sessionData = await getCookieCache(request, {
    secret: process.env.BETTER_AUTH_SECRET,
    strategy: 'jwt',
  });
  const isAuthenticated = !!sessionData?.session;

  // ── Auth routes (sign-in, sign-up, …) ───────────────────────────────────
  const isAuthRoute = authRoutes.includes(pathname);
  if (isAuthRoute) {
    if (isAuthenticated) {
      // Redirect authenticated users to the default post-login destination.
      // The layout/page will then handle role-specific routing via currentUser().
      return NextResponse.redirect(
        new URL(DEFAULT_LOGIN_REDIRECT, request.url),
      );
    }
    return NextResponse.next();
  }

  // ── Public routes ────────────────────────────────────────────────────────
  const isPublicRoute = publicRoutes.includes(pathname);
  if (isPublicRoute) return NextResponse.next();

  // ── Unauthenticated access to any other route → sign-in ─────────────────
  if (!isAuthenticated) {
    const signInUrl = new URL(SIGN_IN_PAGE_PATH, request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
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
