import * as z from 'zod';

const DEFAULT_MIN_WAGE_MONTHLY_PKR = 37_000;
const DEFAULT_WORK_HOURS_MONTHLY = 208;

export const workerParamSchema = z.object({
  workerId: z.string().trim().min(1),
});

export const rollingWindowQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weeks: z.coerce.number().int().min(1).max(156).optional(),
  months: z.coerce.number().int().min(1).max(60).optional(),
  cityZone: z.string().trim().min(1).optional(),
});

export const distributionQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weeks: z.coerce.number().int().min(1).max(52).default(16),
  cityLimit: z.coerce.number().int().min(50).max(5_000).default(1_000),
  workerLimit: z.coerce.number().int().min(20).max(2_000).default(500),
});

export const histogramQuerySchema = rollingWindowQuerySchema.extend({
  bucketSize: z.coerce.number().int().min(500).max(50_000).default(2_500),
});

export const exploitationQuerySchema = rollingWindowQuerySchema
  .extend({
    commissionWeight: z.coerce.number().min(0).max(1).default(0.35),
    volatilityWeight: z.coerce.number().min(0).max(1).default(0.25),
    complaintWeight: z.coerce.number().min(0).max(1).default(0.25),
    suddenDropWeight: z.coerce.number().min(0).max(1).default(0.15),
  })
  .refine(
    (value) =>
      value.commissionWeight +
        value.volatilityWeight +
        value.complaintWeight +
        value.suddenDropWeight >
      0,
    {
      message: 'At least one exploitation score weight must be greater than 0.',
    },
  );

export const earlyWarningQuerySchema = z.object({
  to: z.coerce.date().optional(),
  baselineWeeks: z.coerce.number().int().min(2).max(12).default(4),
  currentWeeks: z.coerce.number().int().min(1).max(4).default(1),
  alertThresholdPct: z.coerce.number().min(1).max(60).default(15),
  cityZone: z.string().trim().min(1).optional(),
});

export const workerRiskQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    days: z.coerce.number().int().min(14).max(180).default(30),
    limit: z.coerce.number().int().min(10).max(250).default(50),
    cityZone: z.string().trim().min(1).optional(),
    incomeDropWeight: z.coerce.number().min(0).max(1).default(0.4),
    deductionsWeight: z.coerce.number().min(0).max(1).default(0.25),
    complaintWeight: z.coerce.number().min(0).max(1).default(0.2),
    verificationWeight: z.coerce.number().min(0).max(1).default(0.15),
  })
  .refine(
    (value) =>
      value.incomeDropWeight +
        value.deductionsWeight +
        value.complaintWeight +
        value.verificationWeight >
      0,
    {
      message: 'At least one worker risk score weight must be greater than 0.',
    },
  );

export const complaintIntelligenceQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weeks: z.coerce.number().int().min(1).max(24).default(4),
  cityZone: z.string().trim().min(1).optional(),
  topKeywords: z.coerce.number().int().min(5).max(40).default(15),
  topIssues: z.coerce.number().int().min(3).max(20).default(8),
});

export const realHourlyWageQuerySchema = z.object({
  workerId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weeks: z.coerce.number().int().min(1).max(156).default(16),
  cityZone: z.string().trim().min(1).optional(),
  minWageMonthlyPkr: z.coerce
    .number()
    .positive()
    .default(DEFAULT_MIN_WAGE_MONTHLY_PKR),
  expectedHoursPerMonth: z.coerce
    .number()
    .positive()
    .default(DEFAULT_WORK_HOURS_MONTHLY),
});
