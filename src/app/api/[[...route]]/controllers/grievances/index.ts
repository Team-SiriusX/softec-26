// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { createGrievanceHandler, getGrievancesHandler } from './handlers';

const createGrievanceSchema = z.object({
  category: z.string(),
  title: z.string(),
  description: z.string(),
  platformId: z.string().optional(),
  workerId: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

const app = new Hono()
  .get('/', getGrievancesHandler)
  .post('/', zValidator('json', createGrievanceSchema), createGrievanceHandler);

export default app;
