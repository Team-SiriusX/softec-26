import { getCookieCache } from 'better-auth/cookies';
import { headers } from 'next/headers';

/**
 * Retrieves the current authenticated user from the session
 * @returns The user object if authenticated, null otherwise
 */

export async function currentUser() {
  try {
    const data = await getCookieCache(await headers(), {
      secret: process.env.BETTER_AUTH_SECRET,
      strategy: 'jwt',
    });

    if (!data?.user) return null;

    const user = data.user;

    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}
