// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';

export const getGrievancesHandler = async (c: Context) => {
  const grievances = await db.grievance.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return c.json({ data: grievances });
};

export const createGrievanceHandler = async (c: Context) => {
  const payload = c.req.valid('json');
  return c.json({ message: 'Grievance scaffold endpoint', payload }, 201);
};
