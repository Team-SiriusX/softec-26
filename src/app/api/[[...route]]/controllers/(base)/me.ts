import { Hono } from 'hono';
import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import db from '@/lib/db';
import type { CurrentUser } from '@/lib/current-user';

type AuthEnv = {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  };
};

const currentUserSelect = {
  id: true,
  email: true,
  role: true,
  fullName: true,
  phone: true,
  cityZone: true,
  category: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  image: true,
} as const;

const me = new Hono<AuthEnv>().get('/', authMiddleware, async (c) => {
  const sessionUser = c.var.user;

  try {
    const user: CurrentUser | null = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: currentUserSelect,
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('Failed to fetch user from DB:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default me;