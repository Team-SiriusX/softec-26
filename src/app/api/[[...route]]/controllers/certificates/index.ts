// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { createCertificateHandler, getCertificateHandler } from './handlers';

const createCertificateSchema = z.object({
  workerId: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
});

const app = new Hono()
  .get(
    '/:id',
    zValidator('param', z.object({ id: z.string() })),
    getCertificateHandler,
  )
  .post(
    '/',
    zValidator('json', createCertificateSchema),
    createCertificateHandler,
  );

export default app;
