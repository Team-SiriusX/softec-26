import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createCertificateHandler,
  getCertificateHandler,
  printCertificateHandler,
} from './handlers';

const createCertificateSchema = z.object({
  workerId: z.string().optional(),
  fromDate: z.string(),
  toDate: z.string(),
});

const app = new Hono()
  .use('/*', authMiddleware)
  .get(
    '/:id',
    zValidator('param', z.object({ id: z.string() })),
    getCertificateHandler,
  )
  .get(
    '/:id/print',
    zValidator('param', z.object({ id: z.string() })),
    printCertificateHandler,
  )
  .post(
    '/',
    zValidator('json', createCertificateSchema),
    createCertificateHandler,
  );

export default app;
