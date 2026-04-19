import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import {
  createSupportTicket,
  getSupportTicket,
  getSupportTicketStats,
  listSupportTickets,
  updateSupportTicket,
} from './handlers';

const supportTicketStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);

const supportTicketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const supportTicketCategorySchema = z.enum([
  'ACCOUNT_ACCESS',
  'PAYMENT',
  'TECHNICAL',
  'SAFETY',
  'OTHER',
]);

const listSupportTicketsQuerySchema = z.object({
  status: supportTicketStatusSchema.optional(),
  priority: supportTicketPrioritySchema.optional(),
  category: supportTicketCategorySchema.optional(),
  workerId: z.string().min(1).optional(),
  assignedAdvocateId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
});

const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(15).max(3000),
  category: supportTicketCategorySchema,
  priority: supportTicketPrioritySchema.optional().default('MEDIUM'),
});

const updateSupportTicketSchema = z
  .object({
    status: supportTicketStatusSchema.optional(),
    priority: supportTicketPrioritySchema.optional(),
    assignedAdvocateId: z.string().trim().min(1).nullable().optional(),
    advocateNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update',
  });

const app = new Hono()
  .use('/', authMiddleware)
  .use('/*', authMiddleware)
  .get('/', zValidator('query', listSupportTicketsQuerySchema), listSupportTickets)
  .get('/stats', getSupportTicketStats)
  .get('/:id', getSupportTicket)
  .post('/', zValidator('json', createSupportTicketSchema), createSupportTicket)
  .patch('/:id', zValidator('json', updateSupportTicketSchema), updateSupportTicket);

export default app;
