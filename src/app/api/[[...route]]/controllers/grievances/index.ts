import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  addTagHandler,
  clusterGrievancesHandler,
  createGrievanceHandler,
  escalateGrievanceHandler,
  getGrievancesHandler,
  resolveGrievanceHandler,
} from './handlers';

const createGrievanceSchema = z.object({
  category: z.enum([
    'COMMISSION_CHANGE',
    'ACCOUNT_DEACTIVATION',
    'PAYMENT_DISPUTE',
    'UNFAIR_RATING',
    'SAFETY_CONCERN',
    'OTHER',
  ]),
  title: z.string().min(3),
  description: z.string().min(10),
  platformId: z.string().optional(),
  workerId: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

const tagSchema = z.object({
  tag: z.string().min(2),
});

const clusterSchema = z.object({
  grievanceIds: z.array(z.string().uuid()).min(1),
  clusterId: z.string().uuid().optional(),
});

const escalationSchema = z.object({
  note: z.string().optional(),
});

const app = new Hono()
  .use('/*', authMiddleware)
  .get('/', getGrievancesHandler)
  .post('/', zValidator('json', createGrievanceSchema), createGrievanceHandler)
  .post('/:id/tags', zValidator('json', tagSchema), addTagHandler)
  .post('/cluster', zValidator('json', clusterSchema), clusterGrievancesHandler)
  .post(
    '/:id/escalate',
    zValidator('json', escalationSchema),
    escalateGrievanceHandler,
  )
  .patch('/:id/resolve', resolveGrievanceHandler);

export default app;
