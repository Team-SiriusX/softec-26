// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  analyzeBatchHandler,
  analyzeWorkerAnomalyHandler,
  getCityMedianHandler,
} from './handlers';

const app = new Hono()
  .post(
    '/analyze',
    zValidator(
      'json',
      z.object({
        workerId: z.string(),
      }),
    ),
    analyzeWorkerAnomalyHandler,
  )
  .post(
    '/batch',
    zValidator(
      'json',
      z.object({
        workerIds: z.array(z.string()),
      }),
    ),
    analyzeBatchHandler,
  )
  .get('/city-median', getCityMedianHandler);

export default app;
