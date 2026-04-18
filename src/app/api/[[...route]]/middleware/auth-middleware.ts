import { getCookieCache } from 'better-auth/cookies';
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
    const session = await getCookieCache(c.req.raw.headers, {
      secret: process.env.BETTER_AUTH_SECRET,
      strategy: 'jwt',
    });

    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const user = session.user;

    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? 'USER',
    });

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
