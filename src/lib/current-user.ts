import { headers } from 'next/headers';
import { auth } from './auth';

/**
 * Retrieves the current authenticated user from the session
 * @returns The user object if authenticated, null otherwise
 */

export async function currentUser() {
  try {
    const data = await auth.api.getSession({
      headers: await headers(),
    });

    if (!data) return null;

    const { user } = data;

    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}
