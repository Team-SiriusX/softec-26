import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createShiftHandler,
  deleteShiftHandler,
  getShiftByIdHandler,
  getShiftsHandler,
  importCsvHandler,
  updateShiftHandler,
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

const updateShiftSchema = z
  .object({
    platform: z.string().min(1).optional(),
    shiftDate: z.string().optional(),
    hoursWorked: z.number().min(0.5).max(24).optional(),
    grossEarned: z.number().positive().optional(),
    platformDeductions: z.number().min(0).optional(),
    netReceived: z.number().optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const app = new Hono()
  .use('/*', authMiddleware)
  .get('/', getShiftsHandler)
  .get('/:id', getShiftByIdHandler)
  .post('/', zValidator('json', createShiftSchema), createShiftHandler)
  .patch('/:id', zValidator('json', updateShiftSchema), updateShiftHandler)
  .delete('/:id', deleteShiftHandler)
  .post('/import', zValidator('json', importCsvSchema), importCsvHandler);

export default app;
