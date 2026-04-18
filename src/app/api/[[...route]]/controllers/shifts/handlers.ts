// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';

export const getShiftsHandler = async (c: Context) => {
  const shifts = await db.shiftLog.findMany({
    include: { platform: true },
    orderBy: { shiftDate: 'desc' },
    take: 100,
  });

  return c.json({ data: shifts });
};

export const createShiftHandler = async (c: Context) => {
  const payload = c.req.valid('json');
  return c.json({ message: 'Shift scaffold endpoint', payload }, 201);
};

export const importCsvHandler = async (c: Context) => {
  const payload = c.req.valid('json');
  return c.json({ message: 'CSV import scaffold endpoint', payload }, 201);
};
