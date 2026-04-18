import { Hono } from 'hono';
import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { WorkerCategory } from '@/generated/prisma/client';
import * as z from 'zod';
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

const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).optional(),
    phone: z.string().nullable().optional(),
    cityZone: z.string().trim().min(1).optional(),
    category: z.nativeEnum(WorkerCategory).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const me = new Hono<AuthEnv>()
  .get('/', authMiddleware, async (c) => {
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
  })
  .patch(
    '/',
    authMiddleware,
    zValidator('json', updateProfileSchema),
    async (c) => {
      const sessionUser = c.var.user;
      const payload = c.req.valid('json');

      try {
        const user = await db.user.update({
          where: { id: sessionUser.id },
          data: {
            ...(payload.fullName !== undefined
              ? { fullName: payload.fullName }
              : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
            ...(payload.cityZone !== undefined
              ? { cityZone: payload.cityZone }
              : {}),
            ...(payload.category !== undefined
              ? { category: payload.category }
              : {}),
          },
          select: currentUserSelect,
        });

        return c.json(user);
      } catch (error) {
        console.error('Failed to update user profile:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
      }
    },
  );

export default me;