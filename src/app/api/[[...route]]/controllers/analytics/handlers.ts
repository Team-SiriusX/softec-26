import db from '@/lib/db';
import { WorkerCategory } from '@/generated/prisma';
import { Context } from 'hono';

// ─── GET /api/analytics/platforms ────────────────────────────────────────────
export const getPlatformStatsHandler = async (c: Context) => {
  const stats = await db.dailyPlatformStat.findMany({
    orderBy: { statDate: 'desc' },
    take: 50,
  });

  return c.json({ data: stats });
};

// ─── GET /api/analytics/median ───────────────────────────────────────────────
// ?category=RIDE_HAILING&zone=Gulberg
export const getMedianHandler = async (c: Context) => {
  const rawCategory = c.req.query('category');
  const zone = c.req.query('zone');

  // Find the most recent DailyPlatformStat row matching filters
  const where: Record<string, unknown> = {};
  if (rawCategory) where.category = rawCategory as WorkerCategory;
  if (zone) where.cityZone = zone;

  const stat = await db.dailyPlatformStat.findFirst({
    where,
    orderBy: { statDate: 'desc' },
  });

  if (!stat) {
    // Fallback: compute from raw shift data for the category
    const shifts = await db.shiftLog.findMany({
      where: {
        worker: {
          ...(rawCategory ? { category: rawCategory as WorkerCategory } : {}),
          ...(zone ? { cityZone: zone } : {}),
        },
        shiftDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { netReceived: true, hoursWorked: true },
    });

    if (shifts.length === 0) {
      return c.json({
        data: {
          medianHourlyRate: null,
          medianNetEarned: null,
          workerCount: 0,
          category: rawCategory ?? null,
          zone: zone ?? null,
        },
      });
    }

    const rates = shifts
      .map((s) =>
        Number(s.hoursWorked) > 0
          ? Number(s.netReceived) / Number(s.hoursWorked)
          : 0,
      )
      .sort((a, b) => a - b);

    const mid = Math.floor(rates.length / 2);
    const median =
      rates.length % 2 === 0
        ? (rates[mid - 1] + rates[mid]) / 2
        : rates[mid];

    const nets = shifts
      .map((s) => Number(s.netReceived))
      .sort((a, b) => a - b);
    const midNet = Math.floor(nets.length / 2);
    const medianNet =
      nets.length % 2 === 0
        ? (nets[midNet - 1] + nets[midNet]) / 2
        : nets[midNet];

    return c.json({
      data: {
        medianHourlyRate: Math.round(median),
        medianNetEarned: Math.round(medianNet),
        workerCount: shifts.length,
        category: rawCategory ?? null,
        zone: zone ?? null,
      },
    });
  }

  return c.json({
    data: {
      medianHourlyRate: null,
      medianNetEarned: Number(stat.medianNetEarned),
      workerCount: stat.workerCount,
      category: stat.category,
      zone: stat.cityZone,
    },
  });
};

// ─── GET /api/analytics/vulnerability ────────────────────────────────────────
export const getVulnerabilityFlagsHandler = async (c: Context) => {
  const flags = await db.vulnerabilityFlag.findMany({
    where: { resolved: false },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ data: flags });
};

// ─── GET /api/analytics/distribution ─────────────────────────────────────────
export const getIncomeDistributionHandler = async (c: Context) => {
  const stats = await db.dailyPlatformStat.findMany({
    orderBy: { statDate: 'desc' },
    take: 30,
  });

  return c.json({ data: stats });
};
