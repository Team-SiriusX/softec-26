import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createShiftHandler,
  getShiftByIdHandler,
  getShiftsHandler,
  importCsvHandler,
} from './handlers';

const createShiftSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  shiftDate: z.string(),
  hoursWorked: z.number().min(0.5).max(24),
  grossEarned: z.number().positive(),
  platformDeductions: z.number().min(0),
  netReceived: z.number(),
  notes: z.string().optional(),
});

const importCsvSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
});

const app = new Hono()
  .use('/*', authMiddleware)
  .get('/', getShiftsHandler)
  .get('/:id', getShiftByIdHandler)
  .post('/', zValidator('json', createShiftSchema), createShiftHandler)
  .post('/import', zValidator('json', importCsvSchema), importCsvHandler);

export default app;
