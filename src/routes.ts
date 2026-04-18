export const authRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forget-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/verify-email/verify',
];

export const publicRoutes = ['/', '/sample', '/chat'];

export const protectedRoutes = [
  '/worker/dashboard',
  '/worker/analytics',
  '/worker/log-shift',
  '/worker/certificate',
  '/worker/profile',
  '/verifier/queue',
  '/advocate/dashboard',
  '/advocate/analytics',
  '/advocate/grievances',
  '/community/board',
];

export const SIGN_IN_PAGE_PATH = '/auth/sign-in';
export const DEFAULT_LOGIN_REDIRECT = '/';
