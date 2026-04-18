// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { getScreenshotsHandler, updateVerificationHandler } from './handlers';

const updateVerificationSchema = z.object({
  status: z.enum(['CONFIRMED', 'FLAGGED', 'UNVERIFIABLE']),
  verifierNotes: z.string().optional(),
});

const app = new Hono()
  .get('/', getScreenshotsHandler)
  .patch(
    '/:id/verify',
    zValidator('param', z.object({ id: z.string() })),
    zValidator('json', updateVerificationSchema),
    updateVerificationHandler,
  );

export default app;
