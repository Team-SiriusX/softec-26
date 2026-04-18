import { auth } from '@/lib/auth';
import { createMiddleware } from 'hono/factory';
import { headers } from 'next/headers';

type UserRole = 'WORKER' | 'VERIFIER' | 'ADVOCATE';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
      headers: await headers(),
    });

    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const user = session.user;
    const role = user.role;

    if (role !== 'WORKER' && role !== 'VERIFIER' && role !== 'ADVOCATE') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
    });

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
