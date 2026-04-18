// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { analyzeWorkerAnomalyHandler } from './handlers';

const app = new Hono().post(
  '/analyze',
  zValidator(
    'json',
    z.object({
      workerId: z.string(),
    }),
  ),
  analyzeWorkerAnomalyHandler,
);

export default app;
