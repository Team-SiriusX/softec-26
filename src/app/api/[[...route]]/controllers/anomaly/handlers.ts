// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';
import { WorkerCategory } from '@/generated/prisma/client';

type AnalyzeRequestPayload = {
  worker_id: string;
  earnings: Array<{
    shift_id: string;
    date: string;
    platform: string;
    hours_worked: number;
    gross_earned: number;
    platform_deduction: number;
    net_received: number;
  }>;
};

type AnalyzeServiceAnomaly = {
  type: string;
  severity: string;
  explanation: string;
  affected_shifts?: string[];
  data?: {
    recent_mean_modified_z?: number;
  };
};

type AnalyzeServiceResponse = {
  anomalies?: AnalyzeServiceAnomaly[];
};

type BatchAnalyzeRequestPayload = {
  workers: AnalyzeRequestPayload[];
};

export const analyzeWorkerAnomalyHandler = async (c: Context) => {
  const { workerId } = await c.req.json<{ workerId: string }>();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const shifts = await db.shiftLog.findMany({
    where: {
      workerId,
      shiftDate: {
        gte: ninetyDaysAgo,
      },
    },
    include: {
      platform: true,
    },
    orderBy: {
      shiftDate: 'asc',
    },
  });

  const payload: AnalyzeRequestPayload = {
    worker_id: workerId,
    earnings: shifts.map((shift) => ({
      shift_id: shift.id,
      date: shift.shiftDate.toISOString().split('T')[0],
      platform: shift.platform.name,
      hours_worked: Number(shift.hoursWorked),
      gross_earned: Number(shift.grossEarned),
      platform_deduction: Number(shift.platformDeductions),
      net_received: Number(shift.netReceived),
    })),
  };

  const serviceUrl =
    process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
  const normalizeServiceBase = (url: string) =>
    url
      .replace(/\/analyze\/?$/, '')
      .replace(/\/detect\/?$/, '')
      .replace(/\/$/, '');

  const analyzeEndpoint = `${normalizeServiceBase(serviceUrl)}/analyze`;

  try {
    const response = await fetch(analyzeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
    }

    const data = (await response.json()) as AnalyzeServiceResponse;

    const anomaliesArray = Array.isArray(data.anomalies) ? data.anomalies : [];

    if (anomaliesArray.length > 0) {
      const representativeShiftId = shifts[0]?.id;

      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const existingToday = await db.anomalyFlag.findMany({
          where: {
            workerId: workerId,
            detectedAt: { gte: todayStart, lte: todayEnd },
          },
          select: { flagType: true },
        });
        const existingTypes = new Set(
          existingToday.map((f: { flagType: string }) => f.flagType),
        );

        const newAnomalies = anomaliesArray.filter(
          (a: { type: string }) => !existingTypes.has(a.type),
        );

        const anomalyRows = newAnomalies.flatMap((anomaly) => {
          const affectedShiftIds = Array.isArray(anomaly.affected_shifts)
            ? anomaly.affected_shifts.filter((shiftId): shiftId is string =>
                typeof shiftId === 'string',
              )
            : [];

          const shiftLogId = affectedShiftIds[0] ?? representativeShiftId;

          if (!shiftLogId) {
            return [];
          }

          const zScore =
            typeof anomaly.data?.recent_mean_modified_z === 'number'
              ? anomaly.data.recent_mean_modified_z
              : null;

          return [
            {
              workerId,
              shiftLogId,
              flagType: anomaly.type,
              severity: anomaly.severity,
              explanation: anomaly.explanation,
              zScore,
            },
          ];
        });

        if (anomalyRows.length > 0) {
          await db.anomalyFlag.createMany({
            data: anomalyRows,
          });
        }
      } catch (error) {
        console.error('Failed to persist anomaly flags', error);
      }
    }

    return c.json(data);
  } catch {
    return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
  }
};

export const detectWorkerAnomalyHandler = async (c: Context) => {
  const { workerId } = await c.req.json<{ workerId: string }>();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const shifts = await db.shiftLog.findMany({
    where: {
      workerId,
      shiftDate: {
        gte: ninetyDaysAgo,
      },
    },
    include: {
      platform: true,
    },
    orderBy: {
      shiftDate: 'asc',
    },
  });

  const payload: AnalyzeRequestPayload = {
    worker_id: workerId,
    earnings: shifts.map((shift) => ({
      shift_id: shift.id,
      date: shift.shiftDate.toISOString().split('T')[0],
      platform: shift.platform.name,
      hours_worked: Number(shift.hoursWorked),
      gross_earned: Number(shift.grossEarned),
      platform_deduction: Number(shift.platformDeductions),
      net_received: Number(shift.netReceived),
    })),
  };

  const serviceUrl =
    process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
  const detectEndpoint = serviceUrl
    .replace(/\/analyze\/?$/, '')
    .replace(/\/detect\/?$/, '')
    .replace(/\/$/, '')
    .concat('/detect');

  try {
    const response = await fetch(detectEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ flags: [], anomalies: [], error: 'anomaly_service_unavailable' });
    }

    const data = (await response.json()) as {
      flags?: AnalyzeServiceAnomaly[];
      worker_id?: string;
      analyzed_shifts?: number;
    };

    // Keep anomalies alias for backwards compatibility on worker UI.
    return c.json({
      workerId: data.worker_id ?? workerId,
      analyzedShifts: data.analyzed_shifts ?? shifts.length,
      flags: data.flags ?? [],
      anomalies: data.flags ?? [],
    });
  } catch {
    return c.json({ flags: [], anomalies: [], error: 'anomaly_service_unavailable' });
  }
};

export const analyzeBatchHandler = async (c: Context) => {
  try {
    const body = await c.req.json<{ workerIds?: string[] }>();
    const workerIds = Array.isArray(body.workerIds) ? body.workerIds : [];

    if (workerIds.length > 50) {
      return c.json({ error: 'Max 50 workers' }, 400);
    }

    const workers = await Promise.all(
      workerIds.map(async (workerId) => {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const shifts = await db.shiftLog.findMany({
          where: {
            workerId,
            shiftDate: {
              gte: ninetyDaysAgo,
            },
          },
          include: {
            platform: true,
          },
          orderBy: {
            shiftDate: 'asc',
          },
        });

        return {
          worker_id: workerId,
          earnings: shifts.map((shift) => ({
            shift_id: shift.id,
            date: shift.shiftDate.toISOString().split('T')[0],
            platform: shift.platform.name,
            hours_worked: Number(shift.hoursWorked),
            gross_earned: Number(shift.grossEarned),
            platform_deduction: Number(shift.platformDeductions),
            net_received: Number(shift.netReceived),
          })),
        };
      }),
    );

    const payload: BatchAnalyzeRequestPayload = {
      workers,
    };

    const serviceUrl =
      process.env.ANOMALY_SERVICE_URL ?? 'http://localhost:8001/analyze';
    const baseUrl = serviceUrl
      .replace(/\/analyze\/?$/, '')
      .replace(/\/$/, '');
    const analyzeBatchEndpoint = `${baseUrl}/analyze/batch?enrich=false`;

    const response = await fetch(analyzeBatchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return c.json({ error: 'anomaly_service_unavailable', results: [] });
    }

    const data = await response.json();
    return c.json(data);
  } catch {
    return c.json({ error: 'anomaly_service_unavailable', results: [] });
  }
};

export const getCityMedianHandler = async (c: Context) => {
  const cityZone = c.req.query('cityZone');
  const categoryParam = c.req.query('category');

  const categoryValues = Object.values(WorkerCategory) as string[];
  const category =
    categoryParam && categoryValues.includes(categoryParam)
      ? (categoryParam as WorkerCategory)
      : undefined;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const stats = await db.dailyPlatformStat.findMany({
    where: {
      ...(cityZone ? { cityZone } : {}),
      ...(category ? { category } : {}),
      statDate: {
        gte: ninetyDaysAgo,
      },
    },
    select: {
      medianNetEarned: true,
      avgCommissionPct: true,
      workerCount: true,
    },
  });

  if (stats.length === 0) {
    return c.json({
      median_hourly: null,
      median_income: null,
      avg_commission_rate: null,
      sample_size: 0,
      message: 'Insufficient data for this zone',
    });
  }

  const sampleSize = stats.reduce((sum, row) => sum + row.workerCount, 0);
  const weightedIncomeNumerator = stats.reduce(
    (sum, row) => sum + Number(row.medianNetEarned) * row.workerCount,
    0,
  );
  const weightedIncomeAverage =
    sampleSize > 0 ? weightedIncomeNumerator / sampleSize : null;
  const commissionAverage =
    stats.reduce((sum, row) => sum + Number(row.avgCommissionPct), 0) /
    stats.length;

  return c.json({
    median_hourly: weightedIncomeAverage,
    median_income: weightedIncomeAverage,
    avg_commission_rate: commissionAverage,
    sample_size: sampleSize,
    city_zone: cityZone || 'all',
    category: category || 'all',
  });
};
