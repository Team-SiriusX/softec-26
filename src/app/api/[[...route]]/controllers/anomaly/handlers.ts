// FairGig scaffold — implement logic here
import db from '@/lib/db';
import { Context } from 'hono';

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

export const analyzeWorkerAnomalyHandler = async (c: Context) => {
  const { workerId } = c.req.valid('json');

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
  const analyzeEndpoint = serviceUrl.endsWith('/analyze')
    ? serviceUrl
    : `${serviceUrl.replace(/\/$/, '')}/analyze`;

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

    const data = await response.json();
    return c.json(data);
  } catch {
    return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
  }
};
