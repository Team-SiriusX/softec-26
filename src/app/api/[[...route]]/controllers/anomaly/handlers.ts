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

    const data = (await response.json()) as AnalyzeServiceResponse;

    const anomalies = Array.isArray(data.anomalies) ? data.anomalies : [];

    if (anomalies.length > 0) {
      const representativeShiftId = shifts[0]?.id;

      const anomalyRows = anomalies.flatMap((anomaly) => {
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
        try {
          await db.anomalyFlag.createMany({
            data: anomalyRows,
          });
        } catch (error) {
          console.error('Failed to persist anomaly flags', error);
        }
      }
    }

    return c.json(data);
  } catch {
    return c.json({ anomalies: [], error: 'anomaly_service_unavailable' });
  }
};
