import { z } from 'zod'

export const grievanceCategoryValues = [
  'COMMISSION_CHANGE',
  'ACCOUNT_DEACTIVATION',
  'PAYMENT_DISPUTE',
  'UNFAIR_RATING',
  'SAFETY_CONCERN',
  'OTHER'
]

export const grievanceStatusValues = [
  'OPEN',
  'TAGGED',
  'ESCALATED',
  'RESOLVED'
]

export const createGrievanceSchema = z.object({
  workerId: z.string().min(1),
  platformId: z.string().min(1),
  category: z.enum(grievanceCategoryValues),
  description: z.string().min(10).max(2000),
  isAnonymous: z.boolean().default(false)
})

export const updateGrievanceSchema = z.object({
  description: z.string().min(10).max(2000).optional(),
  status: z.enum(grievanceStatusValues).optional()
})

export const addTagSchema = z.object({
  tag: z.string().min(1).max(50).trim()
})

export const escalateSchema = z.object({
  advocateId: z.string().min(1),
  note: z.string().min(5).max(500)
})

export const listQuerySchema = z.object({
  platformId: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  workerId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
})
