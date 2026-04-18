import { auth } from '@/lib/auth';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { headers } from 'next/headers';

import type { Role } from '@/generated/prisma/client';

import type { AnalyticsEnv, SessionUser } from './types';

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

function parseSessionUser(data: unknown): SessionUser | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const raw = data as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.email !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    email: raw.email,
    name: typeof raw.name === 'string' ? raw.name : null,
    role: parseRole(raw.role),
  };
}

type DenyStatus = 400 | 401 | 403;

function deny(c: Context, status: DenyStatus, message: string) {
  return c.json({ message }, status);
}

function isOneOfRoles(role: Role, allowedRoles: readonly Role[]) {
  return allowedRoles.includes(role);
}

function shouldAllowWorkerAdvocateRead() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return process.env.ANALYTICS_ALLOW_WORKER_ADVOCATE_VIEW !== 'false';
}

export const analyticsAuthMiddleware = createMiddleware<AnalyticsEnv>(
  async (c, next) => {
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      const user = parseSessionUser(session?.user);

      if (!user) {
        return deny(c, 401, 'Unauthorized');
      }

      c.set('user', user);
      await next();
    } catch (error) {
      console.error('Analytics auth middleware error:', error);
      return deny(c, 401, 'Unauthorized');
    }
  },
);

export const requireWorkerAnalyticsRoleMiddleware = createMiddleware<AnalyticsEnv>(
  async (c, next) => {
    const user = c.get('user');
    const allowed: Role[] = ['WORKER', 'VERIFIER', 'ADVOCATE'];

    if (!isOneOfRoles(user.role, allowed)) {
      return deny(c, 403, 'Forbidden');
    }

    await next();
  },
);

export const requireAdvocateAnalyticsRoleMiddleware =
  createMiddleware<AnalyticsEnv>(async (c, next) => {
    const user = c.get('user');
    const allowed: Role[] = shouldAllowWorkerAdvocateRead()
      ? ['ADVOCATE', 'VERIFIER', 'WORKER']
      : ['ADVOCATE', 'VERIFIER'];

    if (!isOneOfRoles(user.role, allowed)) {
      return deny(c, 403, 'Advocate role required');
    }

    await next();
  });

export const workerTargetMiddleware = createMiddleware<AnalyticsEnv>(
  async (c, next) => {
    const requestedWorkerId = c.req.param('workerId');

    if (!requestedWorkerId) {
      return deny(c, 400, 'workerId is required in route params');
    }

    const user = c.get('user');
    const targetWorkerId =
      requestedWorkerId === 'me' ? user.id : requestedWorkerId;

    if (user.role === 'WORKER' && targetWorkerId !== user.id) {
      return deny(c, 403, 'Workers can only access their own analytics');
    }

    c.set('targetUserId', targetWorkerId);
    await next();
  },
);
