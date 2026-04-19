import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { chatHandler } from './handlers';

const modeSchema = z.enum([
  'auto',
  'worker_evidence',
  'worker_recovery',
  'post_quality',
  'advocate_triage',
  'weekly_brief',
]);

const historySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

const confirmActionSchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().min(1),
  label: z.string().optional(),
  route: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  confirmed: z.boolean().optional(),
});

const draftSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  platformId: z.string().optional(),
  media: z
    .array(
      z.object({
        url: z.string().optional(),
        mediaType: z.string().optional(),
      }),
    )
    .optional(),
});

const chatRequestSchema = z.object({
  mode: modeSchema.default('auto'),
  message: z.string().trim().min(1).max(4000),
  entityId: z.string().optional(),
  history: z.array(historySchema).max(6).optional(),
  threadSummary: z.string().max(1500).optional(),
  draft: draftSchema.optional(),
  confirmAction: confirmActionSchema.optional(),
  stream: z.boolean().optional().default(true),
});

const app = new Hono()
  .use('/*', authMiddleware)
  .post('/chat', zValidator('json', chatRequestSchema), chatHandler);

export default app;
