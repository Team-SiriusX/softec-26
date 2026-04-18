import db from '@/lib/db';
import { Context } from 'hono';

export const getScreenshotsHandler = async (c: Context) => {
  const user = c.var.user as { id: string; role: string } | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const status = c.req.query('status');
  const workerId = c.req.query('workerId');

  const isReviewer = user.role === 'VERIFIER' || user.role === 'ADVOCATE';

  const data = await db.screenshot.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(isReviewer
        ? {
            ...(workerId ? { shiftLog: { workerId } } : {}),
          }
        : {
            shiftLog: {
              workerId: user.id,
            },
          }),
    },
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
    take: 100,
  });

  return c.json({ data });
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
    where: { shiftLogId: body.shiftLogId },
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

  const screenshot = await db.screenshot.findUnique({
    where: { id },
    select: { id: true, shiftLogId: true },
  });

  if (!screenshot) {
    return c.json({ error: 'Screenshot not found' }, 404);
  }

  const [updatedScreenshot] = await db.$transaction([
    db.screenshot.update({
      where: { id },
      data: {
        status: body.status,
        verifierNotes: body.verifierNotes ?? null,
        reviewedAt: new Date(),
        verifierId: user.id,
      },
      include: {
        shiftLog: true,
        verifier: {
          select: { id: true, fullName: true, role: true },
        },
      },
    }),
    db.shiftLog.update({
      where: { id: screenshot.shiftLogId },
      data: {
        verificationStatus: body.status,
      },
    }),
  ]);

  return c.json({ data: updatedScreenshot });
};
