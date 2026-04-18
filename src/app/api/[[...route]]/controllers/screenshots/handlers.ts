// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';

export const getScreenshotsHandler = async (c: Context) => {
  const status = c.req.query('status');

  const data = await db.screenshot.findMany({
    where: status ? { status: status as never } : undefined,
    include: { shiftLog: true, verifier: true },
    orderBy: { uploadedAt: 'desc' },
    take: 100,
  });

  return c.json({ data });
};

export const updateVerificationHandler = async (c: Context) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  return c.json({ message: 'Verification scaffold endpoint', id, body });
};
