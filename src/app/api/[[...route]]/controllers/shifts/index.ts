// FairGig scaffold — implement logic here
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createShiftHandler,
  getShiftsHandler,
  importCsvHandler,
} from './handlers';

const createShiftSchema = z.object({
  workerId: z.string(),
  platformId: z.string(),
  shiftDate: z.string(),
  hoursWorked: z.number(),
  grossEarned: z.number(),
  platformDeductions: z.number(),
  netReceived: z.number(),
  notes: z.string().optional(),
});

const importCsvSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
});

const app = new Hono()
  .get('/', getShiftsHandler)
  .post('/', zValidator('json', createShiftSchema), createShiftHandler)
  .post('/import', zValidator('json', importCsvSchema), importCsvHandler);

export default app;
