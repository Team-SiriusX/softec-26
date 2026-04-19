import db from '@/lib/db';
import { Context } from 'hono';

import { enqueueShiftValidation } from '../shifts/shift-validation-queue';

const SCREENSHOT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'FLAGGED',
  'UNVERIFIABLE',
] as const;

type ScreenshotStatus = (typeof SCREENSHOT_STATUSES)[number];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseStatusFilter(rawStatus: string | undefined): {
  statuses: ScreenshotStatus[];
  hasInvalid: boolean;
} {
  if (!rawStatus) {
    return {
      statuses: [],
      hasInvalid: false,
    };
  }

  const rawTokens = rawStatus
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);

  if (rawTokens.length === 0) {
    return {
      statuses: [],
      hasInvalid: true,
    };
  }

  const hasInvalid = rawTokens.some(
    (token) => !SCREENSHOT_STATUSES.includes(token as ScreenshotStatus),
  );
  const statuses = Array.from(new Set(rawTokens)) as ScreenshotStatus[];

  return {
    statuses,
    hasInvalid,
  };
}

const deriveShiftVerificationStatus = (
  screenshotStatuses: Array<'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE'>,
): 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' => {
  if (screenshotStatuses.length === 0) {
    return 'PENDING';
  }

  if (screenshotStatuses.includes('FLAGGED')) {
    return 'FLAGGED';
  }

  if (screenshotStatuses.includes('UNVERIFIABLE')) {
    return 'UNVERIFIABLE';
  }

  if (screenshotStatuses.includes('PENDING')) {
    return 'PENDING';
  }

  return 'CONFIRMED';
};

export const getScreenshotsHandler = async (c: Context) => {
  const user = c.var.user as { id: string; role: string } | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const status = c.req.query('status');
  const workerId = c.req.query('workerId');
  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = Math.min(parsePositiveInt(c.req.query('pageSize'), 8), 50);
  const { statuses, hasInvalid } = parseStatusFilter(status);

  if (hasInvalid) {
    return c.json(
      {
        error:
          'Invalid status filter. Use PENDING, CONFIRMED, FLAGGED, or UNVERIFIABLE.',
      },
      400,
    );
  }

  const isReviewer = user.role === 'VERIFIER' || user.role === 'ADVOCATE';

  const baseWhere = isReviewer
    ? {
        ...(workerId ? { shiftLog: { workerId } } : {}),
      }
    : {
        shiftLog: {
          workerId: user.id,
        },
      };

  const where = {
    ...baseWhere,
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };

  const [total, statusBuckets] = await Promise.all([
    db.screenshot.count({ where }),
    db.screenshot.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: {
        _all: true,
      },
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  const data = await db.screenshot.findMany({
    where,
    include: {
      shiftLog: {
        include: {
          platform: true,
          worker: {
            select: {
              id: true,
              fullName: true,
              cityZone: true,
            },
          },
        },
      },
      verifier: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const stats: Record<ScreenshotStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    FLAGGED: 0,
    UNVERIFIABLE: 0,
  };

  for (const bucket of statusBuckets) {
    stats[bucket.status] = bucket._count._all;
  }

  return c.json({
    data,
    meta: {
      page: currentPage,
      pageSize,
      total,
      totalPages,
      hasNextPage: totalPages > 0 && currentPage < totalPages,
      hasPrevPage: totalPages > 0 && currentPage > 1,
    },
    stats,
  });
};

export const createScreenshotHandler = async (c: Context) => {
  const user = c.var.user as { id: string; role: string } | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{
    shiftLogId: string;
    fileUrl: string;
    fileKey: string;
  }>();

  const shift = await db.shiftLog.findUnique({
    where: { id: body.shiftLogId },
    select: { id: true, workerId: true },
  });

  if (!shift) {
    return c.json({ error: 'Shift not found' }, 404);
  }

  const isReviewer = user.role === 'VERIFIER' || user.role === 'ADVOCATE';
  if (!isReviewer && shift.workerId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const screenshot = await db.screenshot.upsert({
    where: {
      shiftLogId_fileKey: {
        shiftLogId: body.shiftLogId,
        fileKey: body.fileKey,
      },
    },
    update: {
      fileUrl: body.fileUrl,
      fileKey: body.fileKey,
      status: 'PENDING',
      verifierNotes: null,
      reviewedAt: null,
      verifierId: null,
    },
    create: {
      shiftLogId: body.shiftLogId,
      fileUrl: body.fileUrl,
      fileKey: body.fileKey,
      status: 'PENDING',
    },
  });

  await db.shiftLog.update({
    where: { id: body.shiftLogId },
    data: { verificationStatus: 'PENDING' },
  });

  enqueueShiftValidation(body.shiftLogId);

  return c.json({ data: screenshot }, 201);
};

export const updateVerificationHandler = async (c: Context) => {
  const user = c.var.user as { id: string; role: string } | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const isReviewer = user.role === 'VERIFIER' || user.role === 'ADVOCATE';
  if (!isReviewer) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{
    status: 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
    verifierNotes?: string;
  }>();
  const verifierNotes = body.verifierNotes?.trim();

  const screenshot = await db.screenshot.findUnique({
    where: { id },
    select: { id: true, shiftLogId: true },
  });

  if (!screenshot) {
    return c.json({ error: 'Screenshot not found' }, 404);
  }

  const updatedScreenshot = await db.$transaction(async (tx) => {
    const nextScreenshot = await tx.screenshot.update({
      where: { id },
      data: {
        status: body.status,
        verifierNotes: verifierNotes ? verifierNotes : null,
        reviewedAt: new Date(),
        verifierId: user.id,
      },
      include: {
        shiftLog: true,
        verifier: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    const siblingStatuses = await tx.screenshot.findMany({
      where: { shiftLogId: screenshot.shiftLogId },
      select: { status: true },
    });

    await tx.shiftLog.update({
      where: { id: screenshot.shiftLogId },
      data: {
        verificationStatus: deriveShiftVerificationStatus(
          siblingStatuses.map((item) => item.status),
        ),
      },
    });

    return nextScreenshot;
  });

  return c.json({ data: updatedScreenshot });
};
