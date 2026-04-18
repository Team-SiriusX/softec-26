// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';

export const getCertificateHandler = async (c: Context) => {
  const id = c.req.param('id');
  const certificate = await db.incomeCertificate.findUnique({ where: { id } });

  if (!certificate) {
    return c.json({ message: 'Certificate not found' }, 404);
  }

  return c.json(certificate);
};

export const createCertificateHandler = async (c: Context) => {
  const payload = await c.req.json<unknown>();
  return c.json({ message: 'Certificate scaffold endpoint', payload }, 201);
};
