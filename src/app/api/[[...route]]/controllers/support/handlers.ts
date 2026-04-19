import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/generated/prisma/client';
import db from '@/lib/db';
import { Context } from 'hono';

type SessionUser = {
  id: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  email: string;
  name: string;
};

const supportTicketInclude = {
  worker: {
    select: {
      id: true,
      fullName: true,
      email: true,
      cityZone: true,
    },
  },
  assignedAdvocate: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.SupportTicketInclude;

const supportStatusValues: SupportTicketStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

const supportPriorityValues: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function getUser(c: Context): SessionUser | null {
  const user = c.var.user as SessionUser | undefined;
  if (!user?.id) {
    return null;
  }

  return user;
}

function requireUser(c: Context): SessionUser | Response {
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return user;
}

function requireAdvocate(c: Context): SessionUser | Response {
  const user = requireUser(c);
  if (user instanceof Response) {
    return user;
  }

  if (user.role !== 'ADVOCATE') {
    return c.json({ error: 'Only advocates can perform this action' }, 403);
  }

  return user;
}

function isSupportSchemaMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('support_tickets') && message.includes('does not exist');
}

function handleSupportSchemaError(c: Context, error: unknown): Response | null {
  if (!isSupportSchemaMissing(error)) {
    return null;
  }

  return c.json(
    {
      error:
        'Support ticket schema is not applied yet. Run "pnpm dlx prisma migrate dev --name add-support-ticket-system".',
    },
    500,
  );
}

// GET /api/support
export async function listSupportTickets(c: Context) {
  const user = requireUser(c);
  if (user instanceof Response) {
    return user;
  }

  const query = (c.req as unknown as { valid: (target: 'query') => unknown }).valid('query') as {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: 'ACCOUNT_ACCESS' | 'PAYMENT' | 'TECHNICAL' | 'SAFETY' | 'OTHER';
    workerId?: string;
    assignedAdvocateId?: string;
    limit: number;
    offset: number;
  };

  const where: Prisma.SupportTicketWhereInput = {};

  if (user.role === 'WORKER') {
    where.workerId = user.id;
  } else {
    if (query.workerId) {
      where.workerId = query.workerId;
    }

    if (query.assignedAdvocateId) {
      where.assignedAdvocateId = query.assignedAdvocateId;
    }
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.category) {
    where.category = query.category;
  }

  try {
    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: supportTicketInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      db.supportTicket.count({ where }),
    ]);

    return c.json({
      tickets,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + tickets.length < total,
    });
  } catch (error) {
    const schemaError = handleSupportSchemaError(c, error);
    if (schemaError) {
      return schemaError;
    }

    console.error('Support ticket list failed', error);
    return c.json({ error: 'Failed to list support tickets' }, 500);
  }
}

// GET /api/support/:id
export async function getSupportTicket(c: Context) {
  const user = requireUser(c);
  if (user instanceof Response) {
    return user;
  }

  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'Ticket id is required' }, 400);
  }

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: supportTicketInclude,
    });

    if (!ticket) {
      return c.json({ error: 'Support ticket not found' }, 404);
    }

    if (user.role === 'WORKER' && ticket.workerId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({ ticket });
  } catch (error) {
    const schemaError = handleSupportSchemaError(c, error);
    if (schemaError) {
      return schemaError;
    }

    console.error('Support ticket detail failed', error);
    return c.json({ error: 'Failed to fetch support ticket' }, 500);
  }
}

// POST /api/support
export async function createSupportTicket(c: Context) {
  const user = requireUser(c);
  if (user instanceof Response) {
    return user;
  }

  if (user.role !== 'WORKER') {
    return c.json({ error: 'Only workers can submit support tickets' }, 403);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    subject: string;
    description: string;
    category: 'ACCOUNT_ACCESS' | 'PAYMENT' | 'TECHNICAL' | 'SAFETY' | 'OTHER';
    priority?: SupportTicketPriority;
  };

  try {
    const created = await db.supportTicket.create({
      data: {
        workerId: user.id,
        subject: body.subject.trim(),
        description: body.description.trim(),
        category: body.category,
        priority: body.priority ?? 'MEDIUM',
      },
      include: supportTicketInclude,
    });

    return c.json({ ticket: created }, 201);
  } catch (error) {
    const schemaError = handleSupportSchemaError(c, error);
    if (schemaError) {
      return schemaError;
    }

    console.error('Support ticket create failed', error);
    return c.json({ error: 'Failed to create support ticket' }, 500);
  }
}

// PATCH /api/support/:id
export async function updateSupportTicket(c: Context) {
  const user = requireAdvocate(c);
  if (user instanceof Response) {
    return user;
  }

  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'Ticket id is required' }, 400);
  }

  const body = (c.req as unknown as { valid: (target: 'json') => unknown }).valid('json') as {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assignedAdvocateId?: string | null;
    advocateNote?: string | null;
  };

  try {
    const existing = await db.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        assignedAdvocateId: true,
      },
    });

    if (!existing) {
      return c.json({ error: 'Support ticket not found' }, 404);
    }

    if (body.assignedAdvocateId) {
      const advocate = await db.user.findUnique({
        where: { id: body.assignedAdvocateId },
        select: { id: true, role: true },
      });

      if (!advocate || advocate.role !== 'ADVOCATE') {
        return c.json({ error: 'Assigned user must be an advocate' }, 400);
      }
    }

    const data: Prisma.SupportTicketUpdateInput = {};

    if (body.status) {
      data.status = body.status;
      if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
    }

    if (body.priority) {
      data.priority = body.priority;
    }

    if (body.advocateNote !== undefined) {
      const note = body.advocateNote?.trim() ?? '';
      data.advocateNote = note.length > 0 ? note : null;
    }

    if (body.assignedAdvocateId !== undefined) {
      data.assignedAdvocate = body.assignedAdvocateId
        ? {
            connect: {
              id: body.assignedAdvocateId,
            },
          }
        : {
            disconnect: true,
          };
    } else if (body.status && body.status !== 'OPEN' && !existing.assignedAdvocateId) {
      data.assignedAdvocate = {
        connect: {
          id: user.id,
        },
      };
    }

    const updated = await db.supportTicket.update({
      where: { id },
      data,
      include: supportTicketInclude,
    });

    return c.json({ ticket: updated });
  } catch (error) {
    const schemaError = handleSupportSchemaError(c, error);
    if (schemaError) {
      return schemaError;
    }

    console.error('Support ticket update failed', error);
    return c.json({ error: 'Failed to update support ticket' }, 500);
  }
}

// GET /api/support/stats
export async function getSupportTicketStats(c: Context) {
  const user = requireAdvocate(c);
  if (user instanceof Response) {
    return user;
  }

  try {
    const [total, openCount, unassignedOpenCount, groupedByStatus, groupedByPriority] =
      await Promise.all([
        db.supportTicket.count(),
        db.supportTicket.count({ where: { status: 'OPEN' } }),
        db.supportTicket.count({
          where: {
            status: 'OPEN',
            assignedAdvocateId: null,
          },
        }),
        db.supportTicket.groupBy({ by: ['status'], _count: { id: true } }),
        db.supportTicket.groupBy({ by: ['priority'], _count: { id: true } }),
      ]);

    const byStatus = supportStatusValues.reduce(
      (acc, status) => {
        const row = groupedByStatus.find((entry) => entry.status === status);
        acc[status] = row?._count.id ?? 0;
        return acc;
      },
      {} as Record<SupportTicketStatus, number>,
    );

    const byPriority = supportPriorityValues.reduce(
      (acc, priority) => {
        const row = groupedByPriority.find((entry) => entry.priority === priority);
        acc[priority] = row?._count.id ?? 0;
        return acc;
      },
      {} as Record<SupportTicketPriority, number>,
    );

    return c.json({
      total,
      openCount,
      unassignedOpenCount,
      byStatus,
      byPriority,
    });
  } catch (error) {
    const schemaError = handleSupportSchemaError(c, error);
    if (schemaError) {
      return schemaError;
    }

    console.error('Support ticket stats failed', error);
    return c.json({ error: 'Failed to fetch support ticket stats' }, 500);
  }
}
