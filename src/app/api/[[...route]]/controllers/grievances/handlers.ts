import db from '@/lib/db';
import { Context } from 'hono';
import { randomUUID } from 'crypto';

type SessionUser = {
  id: string;
  role: string;
};

function canModerate(role: string): boolean {
  return role === 'ADVOCATE' || role === 'VERIFIER';
}

export const getGrievancesHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const status = c.req.query('status');
  const category = c.req.query('category');
  const platformId = c.req.query('platformId');
  const clusterId = c.req.query('clusterId');
  const limit = Number(c.req.query('limit') ?? '100');

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(category ? { category: category as never } : {}),
    ...(platformId ? { platformId } : {}),
    ...(clusterId ? { clusterId } : {}),
    ...(user.role === 'WORKER' ? { workerId: user.id } : {}),
  };

  const grievances = await db.grievance.findMany({
    where,
    include: {
      tags: {
        orderBy: { createdAt: 'desc' },
      },
      escalations: {
        orderBy: { escalatedAt: 'desc' },
      },
      worker: {
        select: {
          id: true,
          fullName: true,
          cityZone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 100,
  });

  return c.json({ data: grievances, total: grievances.length });
};

export const createGrievanceHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json<{
    category: string;
    title: string;
    description: string;
    platformId?: string;
    workerId?: string;
    isAnonymous?: boolean;
  }>();

  const workerId =
    user.role === 'WORKER' ? user.id : (payload.workerId ?? null);

  const grievance = await db.grievance.create({
    data: {
      category: payload.category as never,
      title: payload.title,
      description: payload.description,
      platformId: payload.platformId ?? null,
      workerId,
      isAnonymous: payload.isAnonymous ?? false,
      status: 'OPEN',
    },
    include: {
      tags: true,
      escalations: true,
    },
  });

  return c.json({ data: grievance }, 201);
};

export const addTagHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!canModerate(user.role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const { tag } = await c.req.json<{ tag: string }>();

  const grievance = await db.grievance.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!grievance) {
    return c.json({ error: 'Grievance not found' }, 404);
  }

  const created = await db.grievanceTag.upsert({
    where: {
      grievanceId_tag: {
        grievanceId: id,
        tag,
      },
    },
    update: {},
    create: {
      grievanceId: id,
      advocateId: user.id,
      tag,
    },
  });

  await db.grievance.update({
    where: { id },
    data: { status: 'TAGGED' },
  });

  return c.json({ data: created }, 201);
};

export const clusterGrievancesHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!canModerate(user.role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { grievanceIds, clusterId } = await c.req.json<{
    grievanceIds: string[];
    clusterId?: string;
  }>();

  if (!Array.isArray(grievanceIds) || grievanceIds.length === 0) {
    return c.json({ error: 'grievanceIds is required' }, 400);
  }

  const assignedClusterId = clusterId ?? randomUUID();

  const updated = await db.grievance.updateMany({
    where: { id: { in: grievanceIds } },
    data: {
      clusterId: assignedClusterId,
      status: 'TAGGED',
    },
  });

  return c.json({
    data: {
      clusterId: assignedClusterId,
      matched: updated.count,
    },
  });
};

export const escalateGrievanceHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!canModerate(user.role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const { note } = await c.req.json<{ note?: string }>();

  const grievance = await db.grievance.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!grievance) {
    return c.json({ error: 'Grievance not found' }, 404);
  }

  const [updated, escalation] = await db.$transaction([
    db.grievance.update({
      where: { id },
      data: { status: 'ESCALATED' },
    }),
    db.grievanceEscalation.create({
      data: {
        grievanceId: id,
        advocateId: user.id,
        note: note ?? null,
      },
    }),
  ]);

  return c.json({ data: { grievance: updated, escalation } });
};

export const resolveGrievanceHandler = async (c: Context) => {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!canModerate(user.role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');

  const grievance = await db.grievance.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!grievance) {
    return c.json({ error: 'Grievance not found' }, 404);
  }

  const updated = await db.grievance.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });

  return c.json({ data: updated });
};
