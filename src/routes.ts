export const authRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forget-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/verify-email/verify',
];

export const onboardingRoutes = [
  '/worker/onboarding/profile',
  '/worker/onboarding/role-selection',
];

export const publicRoutes = ['/', '/sample', '/chat', '/community/board', '/certificate/verify'];

export const protectedRoutes = [
  '/pending-approval',
  '/worker/dashboard',
  '/worker/community-feed',
  '/worker/analytics',
  '/worker/log-shift',
  '/worker/earnings',
  '/worker/certificate',
  '/worker/profile',
  '/worker/settings',
  '/worker/onboarding/profile',
  '/worker/onboarding/role-selection',
  '/verifier/queue',
  '/verifier/dashboard',
  '/advocate/dashboard',
  '/advocate/analytics',
  '/advocate/grievances',
  '/advocate/community-moderation',
  '/advocate/vulnerability-flags',
  '/advocate/commission-tracker',
  '/advocate/approvals',
];

export const workerRoutes = [
  '/worker/dashboard',
  '/worker/community-feed',
  '/worker/log-shift',
  '/worker/earnings',
  '/worker/certificate',
  '/worker/profile',
  '/worker/settings',
  '/worker/onboarding/profile',
  '/worker/onboarding/role-selection',
];

export const verifierRoutes = ['/verifier/queue', '/verifier/dashboard'];

export const advocateRoutes = [
  '/advocate/dashboard',
  '/advocate/analytics',
  '/advocate/grievances',
  '/advocate/community-moderation',
  '/advocate/vulnerability-flags',
  '/advocate/commission-tracker',
  '/advocate/approvals',
];

export const SIGN_IN_PAGE_PATH = '/auth/sign-in';
export const SIGN_UP_PAGE_PATH = '/auth/sign-up';
export const PENDING_APPROVAL_PAGE_PATH = '/pending-approval';
export const DEFAULT_LOGIN_REDIRECT = '/';

export const roleDefaultDashboards = {
  WORKER: '/worker/dashboard',
  VERIFIER: '/verifier/queue',
  ADVOCATE: '/advocate/dashboard',
} as const;
