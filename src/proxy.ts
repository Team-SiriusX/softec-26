import { getCookieCache } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';
import {
  advocateRoutes,
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  onboardingRoutes,
  PENDING_APPROVAL_PAGE_PATH,
  publicRoutes,
  roleDefaultDashboards,
  SIGN_IN_PAGE_PATH,
  verifierRoutes,
  workerRoutes,
} from './routes';

type UserRole = keyof typeof roleDefaultDashboards;
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type CookieCacheUser = {
  id?: string;
  role?: string;
  approvalStatus?: string;
};

type CookieCacheSession = {
  id?: string;
};

type SessionCookieCache = {
  session?: CookieCacheSession;
  user?: CookieCacheUser;
  updatedAt: number;
};

type FreshSessionPayload = {
  session?: {
    id?: string;
  };
  user?: CookieCacheUser;
} | null;

const roleSet = new Set<UserRole>(['WORKER', 'VERIFIER', 'ADVOCATE']);
const approvalSet = new Set<ApprovalStatus>(['PENDING', 'APPROVED', 'REJECTED']);

const pathMatches = (pathname: string, routes: readonly string[]) => {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
};

const normalizeRole = (role: string | undefined): UserRole | null => {
  if (!role) {
    return null;
  }

  return roleSet.has(role as UserRole) ? (role as UserRole) : null;
};

const normalizeApprovalStatus = (
  approvalStatus: string | undefined,
): ApprovalStatus | null => {
  if (!approvalStatus) {
    return null;
  }

  return approvalSet.has(approvalStatus as ApprovalStatus)
    ? (approvalStatus as ApprovalStatus)
    : null;
};

const requiresAdvocateApproval = (role: UserRole | null): role is 'VERIFIER' | 'ADVOCATE' => {
  return role === 'VERIFIER' || role === 'ADVOCATE';
};

const getFreshApprovalGateUser = async (
  request: NextRequest,
): Promise<{ role: UserRole | null; approvalStatus: ApprovalStatus | null } | null> => {
  try {
    const response = await fetch(
      new URL('/api/auth/get-session?disableCookieCache=true&disableRefresh=true', request.url),
      {
        method: 'GET',
        headers: {
          cookie: request.headers.get('cookie') ?? '',
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as FreshSessionPayload;

    if (!payload?.session?.id || !payload.user?.id) {
      return null;
    }

    return {
      role: normalizeRole(payload.user.role),
      approvalStatus: normalizeApprovalStatus(payload.user.approvalStatus),
    };
  } catch {
    return null;
  }
};

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  const rawCookieCache = await getCookieCache(request, {
    secret: process.env.BETTER_AUTH_SECRET,
    strategy: 'jwt',
  }).catch(() => null);

  const cachedSession = rawCookieCache as SessionCookieCache | null;

  const isAuthenticated = Boolean(
    cachedSession?.session?.id && cachedSession?.user?.id,
  );
  let userRole = normalizeRole(cachedSession?.user?.role);
  let userApprovalStatus = normalizeApprovalStatus(
    cachedSession?.user?.approvalStatus,
  );

  const isAuthRoute = authRoutes.includes(pathname);
  const isPublicRoute = publicRoutes.includes(pathname);
  const isWorkerRoute = pathMatches(pathname, workerRoutes);
  const isVerifierRoute = pathMatches(pathname, verifierRoutes);
  const isAdvocateRoute = pathMatches(pathname, advocateRoutes);
  const isOnboardingRoute = pathMatches(pathname, onboardingRoutes);
  const isPendingApprovalRoute = pathname === PENDING_APPROVAL_PAGE_PATH;

  const isApiRoute =
    pathname.startsWith('/api/') || pathname.startsWith('/trpc/');

  if (isApiRoute) {
    return NextResponse.next();
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const requiresApprovalDecision =
    isAuthRoute || isPendingApprovalRoute || isVerifierRoute || isAdvocateRoute;

  if (
    requiresApprovalDecision &&
    isAuthenticated &&
    requiresAdvocateApproval(userRole) &&
    userApprovalStatus !== 'APPROVED'
  ) {
    const freshApprovalGateUser = await getFreshApprovalGateUser(request);

    if (freshApprovalGateUser) {
      userRole = freshApprovalGateUser.role;
      userApprovalStatus = freshApprovalGateUser.approvalStatus;
    }
  }

  if (isAuthRoute) {
    if (isAuthenticated) {
      if (
        requiresAdvocateApproval(userRole) &&
        userApprovalStatus !== 'APPROVED'
      ) {
        return NextResponse.redirect(
          new URL(PENDING_APPROVAL_PAGE_PATH, request.url),
        );
      }

      const redirectPath = userRole
        ? roleDefaultDashboards[userRole]
        : DEFAULT_LOGIN_REDIRECT;

      return NextResponse.redirect(
        new URL(redirectPath, request.url),
      );
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(SIGN_IN_PAGE_PATH, request.url));
  }

  if (!userRole) {
    return NextResponse.redirect(new URL(SIGN_IN_PAGE_PATH, request.url));
  }

  if (
    requiresAdvocateApproval(userRole) &&
    userApprovalStatus !== 'APPROVED' &&
    !isPendingApprovalRoute
  ) {
    return NextResponse.redirect(new URL(PENDING_APPROVAL_PAGE_PATH, request.url));
  }

  if (
    isPendingApprovalRoute &&
    (!requiresAdvocateApproval(userRole) ||
      userApprovalStatus === 'APPROVED')
  ) {
    return NextResponse.redirect(
      new URL(roleDefaultDashboards[userRole], request.url),
    );
  }

  if (isOnboardingRoute && userRole !== 'WORKER') {
    return NextResponse.redirect(
      new URL(roleDefaultDashboards[userRole], request.url),
    );
  }

  if (
    (isWorkerRoute && userRole !== 'WORKER') ||
    (isVerifierRoute && userRole !== 'VERIFIER') ||
    (isAdvocateRoute && userRole !== 'ADVOCATE')
  ) {
    return NextResponse.redirect(
      new URL(roleDefaultDashboards[userRole], request.url),
    );
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
