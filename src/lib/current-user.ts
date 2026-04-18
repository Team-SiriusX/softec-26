import { getCookieCache } from 'better-auth/cookies';
import { headers } from 'next/headers';

import type { Role } from '@/generated/prisma/client';

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

const ROLE_VALUES = ['WORKER', 'VERIFIER', 'ADVOCATE'] as const;

function parseRole(value: unknown): Role {
  if (
    typeof value === 'string' &&
    (ROLE_VALUES as readonly string[]).includes(value)
  ) {
    return value as Role;
  }

  return 'WORKER' as Role;
}

/**
 * Retrieves the current authenticated user from the session
 * @returns The user object if authenticated, null otherwise
 */

export async function currentUser(): Promise<CurrentUser | null> {
  try {
    const data = await getCookieCache(await headers(), {
      secret: process.env.BETTER_AUTH_SECRET,
      strategy: 'jwt',
    });

    const raw = data?.user;

    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const user = raw as Record<string, unknown>;

    if (typeof user.id !== 'string' || typeof user.email !== 'string') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name:
        typeof user.name === 'string'
          ? user.name
          : typeof user.fullName === 'string'
            ? user.fullName
            : null,
      role: parseRole(user.role),
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}
