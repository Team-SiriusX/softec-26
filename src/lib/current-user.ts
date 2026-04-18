import { auth } from '@/lib/auth';
import type { User } from '@/generated/prisma/client';
import { headers } from 'next/headers';
import db from './db';

export type CurrentUser = Omit<User, 'password'>;

const currentUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  role: true,
  approvalStatus: true,
  fullName: true,
  phone: true,
  cityZone: true,
  category: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  image: true,
} as const;

/**
 * Retrieves the current authenticated user from the DB.
 *
 * @returns The full user object from the DB if authenticated, null otherwise
 */
export async function currentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;
    if (!userId) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: currentUserSelect,
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}
