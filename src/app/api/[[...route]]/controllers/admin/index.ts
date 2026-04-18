import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import db from '@/lib/db';

type AuthEnv = {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
    };
    actor: {
      id: string;
      role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
      approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    };
  };
};

const approvalTargetRoles = ['VERIFIER', 'ADVOCATE'] as const;

const updateApprovalStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

const admin = new Hono<AuthEnv>()
  .use('*', authMiddleware)
  .use('*', async (c, next) => {
    const sessionUser = c.var.user;

    const actor = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
        approvalStatus: true,
      },
    });

    if (!actor) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (actor.role !== 'ADVOCATE' || actor.approvalStatus !== 'APPROVED') {
      return c.json({ error: 'Approved advocate role required' }, 403);
    }

    c.set('actor', actor);
    await next();
  })
  .get('/approvals/pending', async (c) => {
    try {
      const users = await db.user.findMany({
        where: {
          role: { in: [...approvalTargetRoles] },
          approvalStatus: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          approvalStatus: true,
          createdAt: true,
          cityZone: true,
          phone: true,
        },
      });

      return c.json({ users });
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  })
  .patch(
    '/approvals/:userId',
    zValidator('param', userIdParamSchema),
    zValidator('json', updateApprovalStatusSchema),
    async (c) => {
      const { userId } = c.req.valid('param');
      const { status } = c.req.valid('json');
      const actor = c.var.actor;

      if (actor.id === userId) {
        return c.json(
          { error: 'You cannot approve or reject your own account' },
          400,
        );
      }

      try {
        const targetUser = await db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            role: true,
            approvalStatus: true,
          },
        });

        if (!targetUser) {
          return c.json({ error: 'Target user not found' }, 404);
        }
        
        if (targetUser.role.toString() !== 'VERIFIER' && targetUser.role.toString() !== 'ADVOCATE') {
          return c.json(
            {
              error:
                'Only verifier or advocate accounts can be approved or rejected',
            },
            400,
          );
        }

        if (targetUser.approvalStatus !== 'PENDING') {
          return c.json(
            {
              error:
                'Only pending accounts can be approved or rejected',
            },
            409,
          );
        }

        const updated = await db.user.update({
          where: { id: userId },
          data: {
            approvalStatus: status,
          },
          select: {
            id: true,
            role: true,
            approvalStatus: true,
          },
        });

        return c.json({
          message:
            status === 'APPROVED'
              ? 'Account approved successfully'
              : 'Account rejected successfully',
          user: updated,
        });
      } catch (error) {
        console.error('Failed to update approval status:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
      }
    },
  );

export default admin;