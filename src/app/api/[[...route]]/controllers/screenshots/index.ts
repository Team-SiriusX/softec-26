import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createScreenshotHandler,
  getScreenshotsHandler,
  updateVerificationHandler,
} from './handlers';

const createScreenshotSchema = z.object({
  shiftLogId: z.string().uuid(),
  fileUrl: z.string().url(),
  fileKey: z.string().min(1),
});

const updateVerificationSchema = z
  .object({
    status: z.enum(['CONFIRMED', 'FLAGGED', 'UNVERIFIABLE']),
    verifierNotes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const note = value.verifierNotes?.trim() ?? '';
    if ((value.status === 'FLAGGED' || value.status === 'UNVERIFIABLE') && !note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verifierNotes'],
        message: 'A reviewer note is required for flagged or unverifiable screenshots.',
      });
    }
  });

const app = new Hono()
  .use('/*', authMiddleware)
  .get('/', getScreenshotsHandler)
  .post('/', zValidator('json', createScreenshotSchema), createScreenshotHandler)
  .patch(
    '/:id/verify',
    zValidator('param', z.object({ id: z.string() })),
    zValidator('json', updateVerificationSchema),
    updateVerificationHandler,
  );

export default app;
