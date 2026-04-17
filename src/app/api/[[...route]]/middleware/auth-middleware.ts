import { auth } from '@/lib/auth';
import { createMiddleware } from 'hono/factory';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AuthEnv = {
  Variables: {
    user: SessionUser;
  };
};

/**
 * Hono middleware that validates Better Auth session.
 * Extracts user from session cookies/headers and sets `c.var.user`.
 * Returns 401 if no valid session.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('user', {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role:
        ((session.user as Record<string, unknown>).role as string) ?? 'USER',
    });

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
