import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import db from '@/lib/db';
import {
  complaintIntelligenceQuerySchema,
  distributionQuerySchema,
  earlyWarningQuerySchema,
  exploitationQuerySchema,
  histogramQuerySchema,
  realHourlyWageQuerySchema,
  rollingWindowQuerySchema,
  workerParamSchema,
  workerRiskQuerySchema,
} from './schemas';
import {
  analyticsAuthMiddleware,
  requireAdvocateAnalyticsRoleMiddleware,
  requireWorkerAnalyticsRoleMiddleware,
  workerTargetMiddleware,
} from './middleware';
import { getWorkerContext } from './queries';
import type { AnalyticsEnv, NumericLike } from './types';
import {
  extractKeywords,
  normalize,
  resolveWindow,
  shiftDays,
  toIsoDate,
  toNumber,
} from './utils';

const analytics = new Hono<AnalyticsEnv>().use('*', analyticsAuthMiddleware).use('/worker/*', requireWorkerAnalyticsRoleMiddleware).use('/worker/:workerId/*', workerTargetMiddleware).use('/advocate/*', requireAdvocateAnalyticsRoleMiddleware).use('/insights/*', requireAdvocateAnalyticsRoleMiddleware).get(
  '/worker/:workerId/earnings-trend',
  zValidator('param', workerParamSchema),
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(query, 16);
    const cityZone = query.cityZone ?? worker.cityZone ?? null;
    const category = worker.category ?? null;

    type WeeklyEarningsRow = {
      week_start: Date;
      worker_net: NumericLike;
      city_median: NumericLike;
    };

    const rows: WeeklyEarningsRow[] = await db.$queryRaw<WeeklyEarningsRow[]>`
      WITH worker_weekly AS (
        SELECT
          date_trunc('week', sl.shift_date)::date AS week_start,
          SUM(sl.net_received)::numeric AS worker_net
        FROM shift_logs sl
        WHERE sl.worker_id = ${workerId}
          AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1
      ),
      city_worker_weekly AS (
        SELECT
          date_trunc('week', sl.shift_date)::date AS week_start,
          sl.worker_id,
          SUM(sl.net_received)::numeric AS weekly_net
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${cityZone}::text IS NULL OR u.city_zone = ${cityZone})
          AND (${category}::text IS NULL OR u.category::text = ${category})
        GROUP BY 1, 2
      ),
      city_median AS (
        SELECT
          week_start,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY weekly_net) AS city_median
        FROM city_worker_weekly
        GROUP BY 1
      )
      SELECT
        ww.week_start,
        ww.worker_net,
        COALESCE(cm.city_median, 0)::numeric AS city_median
      FROM worker_weekly ww
      LEFT JOIN city_median cm ON cm.week_start = ww.week_start
      ORDER BY ww.week_start ASC
    `;

    const points = rows.map((row) => {
      const workerNet = toNumber(row.worker_net);
      const cityMedianNet = toNumber(row.city_median);

      return {
        weekStart: toIsoDate(row.week_start),
        workerNet,
        cityMedianNet,
        gapToMedian: workerNet - cityMedianNet,
      };
    });

    const latest = points.at(-1);
    const avgGapToMedian =
      points.length === 0
        ? 0
        : points.reduce((acc, point) => acc + point.gapToMedian, 0) / points.length;

    return c.json({
      chart: 'earnings-trend-area',
      meta: {
        workerId,
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone,
        category,
      },
      summary: {
        avgGapToMedian,
        latestGapToMedian: latest?.gapToMedian ?? 0,
      },
      points,
    });
  },
).get(
  '/worker/:workerId/hourly-rate-river',
  zValidator('param', workerParamSchema),
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(query, 16);
    const cityZone = query.cityZone ?? worker.cityZone ?? null;
    const category = worker.category ?? null;

    type HourlyRiverRow = {
      week_start: Date;
      worker_hourly: NumericLike;
      p25: NumericLike;
      median: NumericLike;
      p75: NumericLike;
    };

    const rows: HourlyRiverRow[] = await db.$queryRaw<HourlyRiverRow[]>`
      WITH worker_weekly AS (
        SELECT
          date_trunc('week', sl.shift_date)::date AS week_start,
          CASE
            WHEN SUM(sl.hours_worked) = 0 THEN NULL
            ELSE (SUM(sl.net_received) / SUM(sl.hours_worked))::numeric
          END AS worker_hourly
        FROM shift_logs sl
        WHERE sl.worker_id = ${workerId}
          AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1
      ),
      city_worker_weekly AS (
        SELECT
          date_trunc('week', sl.shift_date)::date AS week_start,
          sl.worker_id,
          CASE
            WHEN SUM(sl.hours_worked) = 0 THEN NULL
            ELSE (SUM(sl.net_received) / SUM(sl.hours_worked))::numeric
          END AS hourly_rate
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${cityZone}::text IS NULL OR u.city_zone = ${cityZone})
          AND (${category}::text IS NULL OR u.category::text = ${category})
        GROUP BY 1, 2
      ),
      city_band AS (
        SELECT
          week_start,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY hourly_rate) AS p25,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY hourly_rate) AS median,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY hourly_rate) AS p75
        FROM city_worker_weekly
        WHERE hourly_rate IS NOT NULL
        GROUP BY 1
      )
      SELECT
        ww.week_start,
        ww.worker_hourly,
        COALESCE(cb.p25, 0)::numeric AS p25,
        COALESCE(cb.median, 0)::numeric AS median,
        COALESCE(cb.p75, 0)::numeric AS p75
      FROM worker_weekly ww
      LEFT JOIN city_band cb ON cb.week_start = ww.week_start
      ORDER BY ww.week_start ASC
    `;

    const points = rows.map((row) => {
      const workerHourly = toNumber(row.worker_hourly);
      const p25 = toNumber(row.p25);
      const median = toNumber(row.median);
      const p75 = toNumber(row.p75);

      let status: 'inside' | 'below' | 'above' = 'inside';

      if (workerHourly < p25) {
        status = 'below';
      }

      if (workerHourly > p75) {
        status = 'above';
      }

      return {
        weekStart: toIsoDate(row.week_start),
        workerHourly,
        p25,
        median,
        p75,
        status,
      };
    });

    return c.json({
      chart: 'hourly-rate-river-stream',
      meta: {
        workerId,
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone,
        category,
      },
      points,
    });
  },
).get(
  '/worker/:workerId/commission-rate-tracker',
  zValidator('param', workerParamSchema),
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(query, 16);

    type CommissionTrackerRow = {
      week_start: Date;
      platform_id: string;
      platform_name: string;
      commission_pct: NumericLike;
    };

    const rows: CommissionTrackerRow[] = await db.$queryRaw<CommissionTrackerRow[]>`
      SELECT
        date_trunc('week', sl.shift_date)::date AS week_start,
        p.id AS platform_id,
        p.name AS platform_name,
        CASE
          WHEN SUM(sl.gross_earned) = 0 THEN 0
          ELSE ((SUM(sl.platform_deductions) / SUM(sl.gross_earned)) * 100)::numeric
        END AS commission_pct
      FROM shift_logs sl
      JOIN platforms p ON p.id = sl.platform_id
      WHERE sl.worker_id = ${workerId}
        AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC, 3 ASC
    `;

    const points = rows.map((row) => ({
      weekStart: toIsoDate(row.week_start),
      platformId: row.platform_id,
      platformName: row.platform_name,
      commissionPct: toNumber(row.commission_pct),
    }));

    const byPlatformMap = new Map<
      string,
      {
        platformId: string;
        platformName: string;
        points: Array<{ weekStart: string; commissionPct: number }>;
      }
    >();

    for (const point of points) {
      const existing = byPlatformMap.get(point.platformId);

      if (existing) {
        existing.points.push({
          weekStart: point.weekStart,
          commissionPct: point.commissionPct,
        });
        continue;
      }

      byPlatformMap.set(point.platformId, {
        platformId: point.platformId,
        platformName: point.platformName,
        points: [{ weekStart: point.weekStart, commissionPct: point.commissionPct }],
      });
    }

    return c.json({
      chart: 'commission-rate-multi-line',
      meta: {
        workerId,
        from: toIsoDate(from),
        to: toIsoDate(to),
      },
      points,
      seriesByPlatform: [...byPlatformMap.values()],
    });
  },
).get(
  '/worker/:workerId/platform-earnings-breakdown',
  zValidator('param', workerParamSchema),
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(query, 24);

    type EarningsBreakdownRow = {
      month_start: Date;
      platform_id: string;
      platform_name: string;
      net_earned: NumericLike;
    };

    const rows: EarningsBreakdownRow[] = await db.$queryRaw<EarningsBreakdownRow[]>`
      SELECT
        date_trunc('month', sl.shift_date)::date AS month_start,
        p.id AS platform_id,
        p.name AS platform_name,
        SUM(sl.net_received)::numeric AS net_earned
      FROM shift_logs sl
      JOIN platforms p ON p.id = sl.platform_id
      WHERE sl.worker_id = ${workerId}
        AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC, 3 ASC
    `;

    const points = rows.map((row) => ({
      monthStart: toIsoDate(row.month_start),
      platformId: row.platform_id,
      platformName: row.platform_name,
      netEarned: toNumber(row.net_earned),
    }));

    return c.json({
      chart: 'platform-earnings-stacked-bar',
      meta: {
        workerId,
        from: toIsoDate(from),
        to: toIsoDate(to),
      },
      points,
    });
  },
).get(
  '/worker/:workerId/earnings-distribution-dot-plot',
  zValidator('param', workerParamSchema),
  zValidator('query', distributionQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(
      {
        from: query.from,
        to: query.to,
        weeks: query.weeks,
      },
      16,
    );

    const cityZone = worker.cityZone ?? null;
    const category = worker.category ?? null;

    type DotPlotRow = {
      shift_date: Date;
      hours_worked: NumericLike;
      net_received: NumericLike;
      platform_name: string;
    };

    const workerRows: DotPlotRow[] = await db.$queryRaw<DotPlotRow[]>`
      SELECT
        sl.shift_date,
        sl.hours_worked,
        sl.net_received,
        p.name AS platform_name
      FROM shift_logs sl
      JOIN platforms p ON p.id = sl.platform_id
      WHERE sl.worker_id = ${workerId}
        AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY sl.shift_date DESC
      LIMIT ${query.workerLimit}
    `;

    const cityRows: DotPlotRow[] = await db.$queryRaw<DotPlotRow[]>`
      SELECT
        sl.shift_date,
        sl.hours_worked,
        sl.net_received,
        p.name AS platform_name
      FROM shift_logs sl
      JOIN "User" u ON u.id = sl.worker_id
      JOIN platforms p ON p.id = sl.platform_id
      WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
        AND sl.worker_id <> ${workerId}
        AND (${cityZone}::text IS NULL OR u.city_zone = ${cityZone})
        AND (${category}::text IS NULL OR u.category::text = ${category})
      ORDER BY sl.shift_date DESC
      LIMIT ${query.cityLimit}
    `;

    const workerPoints = workerRows.map((row) => ({
      shiftDate: toIsoDate(row.shift_date),
      hoursWorked: toNumber(row.hours_worked),
      netEarned: toNumber(row.net_received),
      platformName: row.platform_name,
      pointType: 'worker' as const,
    }));

    const cityPoints = cityRows.map((row) => ({
      shiftDate: toIsoDate(row.shift_date),
      hoursWorked: toNumber(row.hours_worked),
      netEarned: toNumber(row.net_received),
      platformName: row.platform_name,
      pointType: 'city' as const,
    }));

    return c.json({
      chart: 'earnings-distribution-scatter',
      meta: {
        workerId,
        cityZone,
        category,
        from: toIsoDate(from),
        to: toIsoDate(to),
      },
      workerPoints,
      cityPoints,
    });
  },
).get(
  '/worker/:workerId/verification-status-donut',
  zValidator('param', workerParamSchema),
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const workerId = c.get('targetUserId');

    if (!workerId) {
      return c.json({ message: 'Unable to resolve target user.' }, 400);
    }

    const worker = await getWorkerContext(workerId);

    if (!worker) {
      return c.json({ message: 'Worker not found.' }, 404);
    }

    const { from, to } = resolveWindow(query, 24);

    const grouped = await db.shiftLog.groupBy({
      by: ['verificationStatus'] as const,
      where: {
        workerId,
        shiftDate: {
          gte: from,
          lte: to,
        },
      },
      _count: {
        _all: true,
      },
    });

    const statusOrder = ['CONFIRMED', 'PENDING', 'FLAGGED', 'UNVERIFIABLE'] as const;

    const points = statusOrder.map((status) => {
      const record = grouped.find((entry) => entry.verificationStatus === status);
      return {
        status,
        count: record?._count._all ?? 0,
      };
    });

    const total = points.reduce((acc, point) => acc + point.count, 0);

    return c.json({
      chart: 'verification-status-donut',
      meta: {
        workerId,
        from: toIsoDate(from),
        to: toIsoDate(to),
      },
      total,
      points,
    });
  },
).get(
  '/advocate/commission-rate-heatmap',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type HeatmapRow = {
      week_start: Date;
      platform_id: string;
      platform_name: string;
      avg_commission_pct: NumericLike;
    };

    const rows: HeatmapRow[] = await db.$queryRaw<HeatmapRow[]>`
      SELECT
        date_trunc('week', sl.shift_date)::date AS week_start,
        p.id AS platform_id,
        p.name AS platform_name,
        AVG(
          CASE
            WHEN sl.gross_earned = 0 THEN 0
            ELSE (sl.platform_deductions / sl.gross_earned) * 100
          END
        )::numeric AS avg_commission_pct
      FROM shift_logs sl
      JOIN platforms p ON p.id = sl.platform_id
      JOIN "User" u ON u.id = sl.worker_id
      WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC, 3 ASC
    `;

    const cells = rows.map((row) => ({
      weekStart: toIsoDate(row.week_start),
      platformId: row.platform_id,
      platformName: row.platform_name,
      avgCommissionPct: toNumber(row.avg_commission_pct),
    }));

    return c.json({
      chart: 'commission-rate-heatmap',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      cells,
    });
  },
).get(
  '/advocate/income-distribution-histogram',
  zValidator('query', histogramQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type HistogramRow = {
      platform_id: string;
      platform_name: string;
      bucket_start: NumericLike;
      bucket_end: NumericLike;
      worker_count: NumericLike;
    };

    const rows: HistogramRow[] = await db.$queryRaw<HistogramRow[]>`
      WITH worker_platform_income AS (
        SELECT
          sl.platform_id,
          sl.worker_id,
          SUM(sl.net_received)::numeric AS total_net
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2
      )
      SELECT
        p.id AS platform_id,
        p.name AS platform_name,
        (floor((wpi.total_net / ${query.bucketSize})::numeric) * ${query.bucketSize})::numeric AS bucket_start,
        ((floor((wpi.total_net / ${query.bucketSize})::numeric) * ${query.bucketSize}) + ${query.bucketSize})::numeric AS bucket_end,
        COUNT(*)::int AS worker_count
      FROM worker_platform_income wpi
      JOIN platforms p ON p.id = wpi.platform_id
      GROUP BY 1, 2, 3, 4
      ORDER BY 2 ASC, 3 ASC
    `;

    const buckets = rows.map((row) => ({
      platformId: row.platform_id,
      platformName: row.platform_name,
      bucketStart: toNumber(row.bucket_start),
      bucketEnd: toNumber(row.bucket_end),
      workerCount: toNumber(row.worker_count),
    }));

    return c.json({
      chart: 'income-distribution-histogram',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
        bucketSize: query.bucketSize,
      },
      buckets,
    });
  },
).get(
  '/advocate/grievance-bump-chart',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 8);

    type BumpRow = {
      week_start: Date;
      category: string;
      complaint_count: NumericLike;
      category_rank: NumericLike;
    };

    const rows: BumpRow[] = await db.$queryRaw<BumpRow[]>`
      WITH weekly_category_counts AS (
        SELECT
          date_trunc('week', g.created_at)::date AS week_start,
          g.category::text AS category,
          COUNT(*)::int AS complaint_count
        FROM grievances g
        LEFT JOIN "User" u ON u.id = g.worker_id
        WHERE g.created_at::date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2
      )
      SELECT
        week_start,
        category,
        complaint_count,
        DENSE_RANK() OVER (
          PARTITION BY week_start
          ORDER BY complaint_count DESC, category ASC
        ) AS category_rank
      FROM weekly_category_counts
      ORDER BY week_start ASC, category_rank ASC
    `;

    const points = rows.map((row) => ({
      weekStart: toIsoDate(row.week_start),
      category: row.category,
      complaintCount: toNumber(row.complaint_count),
      rank: toNumber(row.category_rank),
    }));

    return c.json({
      chart: 'grievance-category-bump',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      points,
    });
  },
).get(
  '/advocate/vulnerability-flag-timeline',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 52);

    type VulnerabilityRow = {
      month_start: Date;
      city_zone: string;
      flagged_workers: NumericLike;
    };

    const rows: VulnerabilityRow[] = await db.$queryRaw<VulnerabilityRow[]>`
      SELECT
        date_trunc('month', vf.flag_month)::date AS month_start,
        COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
        COUNT(*)::int AS flagged_workers
      FROM vulnerability_flags vf
      JOIN "User" u ON u.id = vf.worker_id
      WHERE vf.flag_month BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `;

    const bars = rows.map((row) => ({
      monthStart: toIsoDate(row.month_start),
      cityZone: row.city_zone,
      flaggedWorkers: toNumber(row.flagged_workers),
    }));

    return c.json({
      chart: 'vulnerability-flag-timeline',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      bars,
    });
  },
).get(
  '/advocate/platform-comparison-radar',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type RadarRow = {
      platform_id: string;
      platform_name: string;
      median_earnings: NumericLike;
      avg_commission_pct: NumericLike;
      verification_rate_pct: NumericLike;
      grievance_count: NumericLike;
      anomaly_flag_count: NumericLike;
    };

    const rows: RadarRow[] = await db.$queryRaw<RadarRow[]>`
      WITH shift_stats AS (
        SELECT
          sl.platform_id,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY sl.net_received) AS median_earnings,
          AVG(
            CASE
              WHEN sl.gross_earned = 0 THEN 0
              ELSE (sl.platform_deductions / sl.gross_earned) * 100
            END
          ) AS avg_commission_pct,
          AVG(
            CASE
              WHEN sl.verification_status = 'CONFIRMED' THEN 1
              ELSE 0
            END
          ) * 100 AS verification_rate_pct
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1
      ),
      grievance_stats AS (
        SELECT
          g.platform_id,
          COUNT(*)::int AS grievance_count
        FROM grievances g
        LEFT JOIN "User" u ON u.id = g.worker_id
        WHERE g.created_at::date BETWEEN ${from}::date AND ${to}::date
          AND g.platform_id IS NOT NULL
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1
      ),
      anomaly_stats AS (
        SELECT
          sl.platform_id,
          COUNT(*)::int AS anomaly_flag_count
        FROM anomaly_flags af
        JOIN shift_logs sl ON sl.id = af.shift_log_id
        JOIN "User" u ON u.id = sl.worker_id
        WHERE af.detected_at::date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1
      )
      SELECT
        p.id AS platform_id,
        p.name AS platform_name,
        COALESCE(ss.median_earnings, 0)::numeric AS median_earnings,
        COALESCE(ss.avg_commission_pct, 0)::numeric AS avg_commission_pct,
        COALESCE(ss.verification_rate_pct, 0)::numeric AS verification_rate_pct,
        COALESCE(gs.grievance_count, 0)::int AS grievance_count,
        COALESCE(an.anomaly_flag_count, 0)::int AS anomaly_flag_count
      FROM shift_stats ss
      JOIN platforms p ON p.id = ss.platform_id
      LEFT JOIN grievance_stats gs ON gs.platform_id = ss.platform_id
      LEFT JOIN anomaly_stats an ON an.platform_id = ss.platform_id
      ORDER BY p.name ASC
    `;

    const platforms = rows.map((row) => ({
      platformId: row.platform_id,
      platformName: row.platform_name,
      medianEarnings: toNumber(row.median_earnings),
      avgCommissionPct: toNumber(row.avg_commission_pct),
      grievanceCount: toNumber(row.grievance_count),
      verificationRatePct: toNumber(row.verification_rate_pct),
      anomalyFlagCount: toNumber(row.anomaly_flag_count),
    }));

    return c.json({
      chart: 'platform-comparison-radar',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      platforms,
    });
  },
).get(
  '/advocate/city-zone-treemap',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type TreemapRow = {
      city_zone: string;
      worker_count: NumericLike;
      median_net_earned: NumericLike;
    };

    const rows: TreemapRow[] = await db.$queryRaw<TreemapRow[]>`
      SELECT
        COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
        COUNT(DISTINCT sl.worker_id)::int AS worker_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY sl.net_received)::numeric AS median_net_earned
      FROM shift_logs sl
      JOIN "User" u ON u.id = sl.worker_id
      WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const nodes = rows.map((row) => ({
      cityZone: row.city_zone,
      workerCount: toNumber(row.worker_count),
      medianNetEarned: toNumber(row.median_net_earned),
    }));

    return c.json({
      chart: 'city-zone-treemap',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZoneFilter: query.cityZone ?? null,
      },
      nodes,
    });
  },
).get(
  '/advocate/complaint-cluster-stream',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 8);

    type ComplaintStreamRow = {
      week_start: Date;
      category: string;
      complaint_count: NumericLike;
    };

    const rows: ComplaintStreamRow[] = await db.$queryRaw<ComplaintStreamRow[]>`
      SELECT
        date_trunc('week', g.created_at)::date AS week_start,
        g.category::text AS category,
        COUNT(*)::int AS complaint_count
      FROM grievances g
      LEFT JOIN "User" u ON u.id = g.worker_id
      WHERE g.created_at::date BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `;

    const layers = rows.map((row) => ({
      weekStart: toIsoDate(row.week_start),
      category: row.category,
      count: toNumber(row.complaint_count),
    }));

    return c.json({
      chart: 'complaint-cluster-stream',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      layers,
    });
  },
).get(
  '/insights/platform-exploitation-score',
  zValidator('query', exploitationQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type ExploitationMetricRow = {
      platform_id: string;
      platform_name: string;
      avg_commission_pct: NumericLike;
      income_volatility: NumericLike;
      grievance_count: NumericLike;
      active_workers: NumericLike;
      vulnerable_workers: NumericLike;
    };

    const rows: ExploitationMetricRow[] = await db.$queryRaw<ExploitationMetricRow[]>`
      WITH worker_weekly_platform AS (
        SELECT
          sl.platform_id,
          sl.worker_id,
          date_trunc('week', sl.shift_date)::date AS week_start,
          SUM(sl.net_received)::numeric AS weekly_net,
          SUM(sl.platform_deductions)::numeric AS weekly_deductions,
          SUM(sl.gross_earned)::numeric AS weekly_gross
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2, 3
      ),
      platform_shift_metrics AS (
        SELECT
          wwp.platform_id,
          AVG(
            CASE
              WHEN wwp.weekly_gross = 0 THEN 0
              ELSE (wwp.weekly_deductions / wwp.weekly_gross) * 100
            END
          )::numeric AS avg_commission_pct,
          COALESCE(STDDEV_POP(wwp.weekly_net), 0)::numeric AS income_volatility,
          COUNT(DISTINCT wwp.worker_id)::int AS active_workers
        FROM worker_weekly_platform wwp
        GROUP BY 1
      ),
      grievance_metrics AS (
        SELECT
          g.platform_id,
          COUNT(*)::int AS grievance_count
        FROM grievances g
        LEFT JOIN "User" u ON u.id = g.worker_id
        WHERE g.platform_id IS NOT NULL
          AND g.created_at::date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1
      ),
      vulnerable_workers AS (
        SELECT DISTINCT vf.worker_id
        FROM vulnerability_flags vf
        JOIN "User" u ON u.id = vf.worker_id
        WHERE vf.flag_month BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      ),
      sudden_drop_metrics AS (
        SELECT
          wwp.platform_id,
          COUNT(DISTINCT wwp.worker_id)::int AS vulnerable_workers
        FROM worker_weekly_platform wwp
        JOIN vulnerable_workers vw ON vw.worker_id = wwp.worker_id
        GROUP BY 1
      )
      SELECT
        p.id AS platform_id,
        p.name AS platform_name,
        COALESCE(psm.avg_commission_pct, 0)::numeric AS avg_commission_pct,
        COALESCE(psm.income_volatility, 0)::numeric AS income_volatility,
        COALESCE(gm.grievance_count, 0)::int AS grievance_count,
        COALESCE(psm.active_workers, 0)::int AS active_workers,
        COALESCE(sdm.vulnerable_workers, 0)::int AS vulnerable_workers
      FROM platform_shift_metrics psm
      JOIN platforms p ON p.id = psm.platform_id
      LEFT JOIN grievance_metrics gm ON gm.platform_id = psm.platform_id
      LEFT JOIN sudden_drop_metrics sdm ON sdm.platform_id = psm.platform_id
      ORDER BY p.name ASC
    `;

    const metrics = rows.map((row) => {
      const activeWorkers = toNumber(row.active_workers);
      const grievanceCount = toNumber(row.grievance_count);
      const vulnerableWorkers = toNumber(row.vulnerable_workers);

      return {
        platformId: row.platform_id,
        platformName: row.platform_name,
        avgCommissionPct: toNumber(row.avg_commission_pct),
        incomeVolatility: toNumber(row.income_volatility),
        complaintDensity: activeWorkers === 0 ? 0 : (grievanceCount / activeWorkers) * 100,
        suddenDropFrequency: activeWorkers === 0 ? 0 : (vulnerableWorkers / activeWorkers) * 100,
        activeWorkers,
        grievanceCount,
        vulnerableWorkers,
      };
    });

    const commissionNorm = normalize(metrics.map((metric) => metric.avgCommissionPct));
    const volatilityNorm = normalize(metrics.map((metric) => metric.incomeVolatility));
    const complaintNorm = normalize(metrics.map((metric) => metric.complaintDensity));
    const dropNorm = normalize(metrics.map((metric) => metric.suddenDropFrequency));

    const totalWeight =
      query.commissionWeight +
      query.volatilityWeight +
      query.complaintWeight +
      query.suddenDropWeight;

    const weights = {
      commission: query.commissionWeight / totalWeight,
      volatility: query.volatilityWeight / totalWeight,
      complaint: query.complaintWeight / totalWeight,
      suddenDrop: query.suddenDropWeight / totalWeight,
    };

    const ranking = metrics
      .map((metric, index) => {
        const score =
          commissionNorm[index] * weights.commission +
          volatilityNorm[index] * weights.volatility +
          complaintNorm[index] * weights.complaint +
          dropNorm[index] * weights.suddenDrop;

        return {
          ...metric,
          exploitationScore: score * 100,
          normalizedComponents: {
            commission: commissionNorm[index],
            volatility: volatilityNorm[index],
            complaint: complaintNorm[index],
            suddenDrop: dropNorm[index],
          },
        };
      })
      .sort((a, b) => b.exploitationScore - a.exploitationScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return c.json({
      insight: 'platform-exploitation-score',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
        weights,
      },
      ranking,
    });
  },
).get(
  '/insights/income-volatility-index',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 4);

    type VolatilityRow = {
      city_zone: string;
      platform_id: string;
      platform_name: string;
      volatility_index: NumericLike;
      worker_count: NumericLike;
    };

    const rows: VolatilityRow[] = await db.$queryRaw<VolatilityRow[]>`
      WITH worker_daily AS (
        SELECT
          sl.worker_id,
          sl.platform_id,
          sl.shift_date::date AS day,
          SUM(sl.net_received)::numeric AS daily_net
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2, 3
      ),
      worker_volatility AS (
        SELECT
          wd.worker_id,
          wd.platform_id,
          COALESCE(STDDEV_POP(wd.daily_net), 0)::numeric AS volatility
        FROM worker_daily wd
        GROUP BY 1, 2
      )
      SELECT
        COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
        p.id AS platform_id,
        p.name AS platform_name,
        AVG(wv.volatility)::numeric AS volatility_index,
        COUNT(*)::int AS worker_count
      FROM worker_volatility wv
      JOIN "User" u ON u.id = wv.worker_id
      JOIN platforms p ON p.id = wv.platform_id
      GROUP BY 1, 2, 3
      ORDER BY volatility_index DESC, worker_count DESC
    `;

    const points = rows.map((row) => ({
      cityZone: row.city_zone,
      platformId: row.platform_id,
      platformName: row.platform_name,
      volatilityIndex: toNumber(row.volatility_index),
      workerCount: toNumber(row.worker_count),
    }));

    return c.json({
      insight: 'income-volatility-index',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      points,
    });
  },
).get(
  '/insights/early-warning',
  zValidator('query', earlyWarningQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    const to = query.to ?? new Date();
    const currentWindowStart = shiftDays(to, -query.currentWeeks * 7);
    const baselineWindowStart = shiftDays(currentWindowStart, -query.baselineWeeks * 7);

    type EarlyWarningRow = {
      platform_id: string;
      platform_name: string;
      city_zone: string;
      current_avg_net: NumericLike;
      baseline_avg_net: NumericLike;
      drop_pct: NumericLike;
    };

    const rows: EarlyWarningRow[] = await db.$queryRaw<EarlyWarningRow[]>`
      WITH weekly_platform_zone AS (
        SELECT
          date_trunc('week', sl.shift_date)::date AS week_start,
          sl.platform_id,
          COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
          AVG(sl.net_received)::numeric AS avg_net_per_shift
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${baselineWindowStart}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2, 3
      ),
      current_window AS (
        SELECT
          platform_id,
          city_zone,
          AVG(avg_net_per_shift)::numeric AS current_avg_net
        FROM weekly_platform_zone
        WHERE week_start >= ${currentWindowStart}::date
        GROUP BY 1, 2
      ),
      baseline_window AS (
        SELECT
          platform_id,
          city_zone,
          AVG(avg_net_per_shift)::numeric AS baseline_avg_net
        FROM weekly_platform_zone
        WHERE week_start < ${currentWindowStart}::date
        GROUP BY 1, 2
      )
      SELECT
        p.id AS platform_id,
        p.name AS platform_name,
        cw.city_zone,
        cw.current_avg_net,
        bw.baseline_avg_net,
        CASE
          WHEN bw.baseline_avg_net = 0 THEN 0
          ELSE ((bw.baseline_avg_net - cw.current_avg_net) / bw.baseline_avg_net) * 100
        END::numeric AS drop_pct
      FROM current_window cw
      JOIN baseline_window bw
        ON bw.platform_id = cw.platform_id
       AND bw.city_zone = cw.city_zone
      JOIN platforms p ON p.id = cw.platform_id
      WHERE bw.baseline_avg_net > 0
      ORDER BY drop_pct DESC
    `;

    const alerts = rows
      .map((row) => {
        const dropPct = toNumber(row.drop_pct);

        return {
          platformId: row.platform_id,
          platformName: row.platform_name,
          cityZone: row.city_zone,
          currentAvgNet: toNumber(row.current_avg_net),
          baselineAvgNet: toNumber(row.baseline_avg_net),
          dropPct,
          severity:
            dropPct >= 30 ? 'critical' : dropPct >= query.alertThresholdPct ? 'warning' : 'normal',
        };
      })
      .filter((item) => item.dropPct >= query.alertThresholdPct)
      .sort((a, b) => b.dropPct - a.dropPct);

    return c.json({
      insight: 'early-warning',
      meta: {
        baselineWindowStart: toIsoDate(baselineWindowStart),
        currentWindowStart: toIsoDate(currentWindowStart),
        
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
        thresholdPct: query.alertThresholdPct,
      },
      alerts,
    });
  },
).get(
  '/insights/worker-risk-scores',
  zValidator('query', workerRiskQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    const currentTo = query.to ?? new Date();
    const currentFrom = query.from ?? shiftDays(currentTo, -query.days);

    const periodMs = currentTo.getTime() - currentFrom.getTime();
    const previousTo = shiftDays(currentFrom, -1);
    const previousFrom = new Date(previousTo.getTime() - periodMs);

    type WorkerRiskRow = {
      worker_id: string;
      full_name: string;
      city_zone: string;
      curr_net: NumericLike;
      prev_net: NumericLike;
      income_drop_pct: NumericLike;
      commission_pct: NumericLike;
      grievance_count: NumericLike;
      unverified_pct: NumericLike;
      vulnerability_count: NumericLike;
    };

    const rows: WorkerRiskRow[] = await db.$queryRaw<WorkerRiskRow[]>`
      WITH current_period AS (
        SELECT
          sl.worker_id,
          SUM(sl.net_received)::numeric AS curr_net,
          SUM(sl.platform_deductions)::numeric AS curr_deductions,
          SUM(sl.gross_earned)::numeric AS curr_gross,
          AVG(
            CASE
              WHEN sl.verification_status = 'CONFIRMED' THEN 1
              ELSE 0
            END
          )::numeric AS verification_rate
        FROM shift_logs sl
        WHERE sl.shift_date BETWEEN ${currentFrom}::date AND ${currentTo}::date
        GROUP BY 1
      ),
      previous_period AS (
        SELECT
          sl.worker_id,
          SUM(sl.net_received)::numeric AS prev_net
        FROM shift_logs sl
        WHERE sl.shift_date BETWEEN ${previousFrom}::date AND ${previousTo}::date
        GROUP BY 1
      ),
      grievance_counts AS (
        SELECT
          g.worker_id,
          COUNT(*)::int AS grievance_count
        FROM grievances g
        WHERE g.worker_id IS NOT NULL
          AND g.created_at::date BETWEEN ${currentFrom}::date AND ${currentTo}::date
        GROUP BY 1
      ),
      vulnerability_counts AS (
        SELECT
          vf.worker_id,
          COUNT(*)::int AS vulnerability_count
        FROM vulnerability_flags vf
        WHERE vf.flag_month BETWEEN ${currentFrom}::date AND ${currentTo}::date
        GROUP BY 1
      )
      SELECT
        u.id AS worker_id,
        u.full_name,
        COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
        COALESCE(cp.curr_net, 0)::numeric AS curr_net,
        COALESCE(pp.prev_net, 0)::numeric AS prev_net,
        CASE
          WHEN COALESCE(pp.prev_net, 0) = 0 THEN 0
          ELSE ((COALESCE(pp.prev_net, 0) - COALESCE(cp.curr_net, 0)) / COALESCE(pp.prev_net, 0)) * 100
        END::numeric AS income_drop_pct,
        CASE
          WHEN COALESCE(cp.curr_gross, 0) = 0 THEN 0
          ELSE (COALESCE(cp.curr_deductions, 0) / COALESCE(cp.curr_gross, 0)) * 100
        END::numeric AS commission_pct,
        COALESCE(gc.grievance_count, 0)::int AS grievance_count,
        ((1 - COALESCE(cp.verification_rate, 0)) * 100)::numeric AS unverified_pct,
        COALESCE(vc.vulnerability_count, 0)::int AS vulnerability_count
      FROM "User" u
      LEFT JOIN current_period cp ON cp.worker_id = u.id
      LEFT JOIN previous_period pp ON pp.worker_id = u.id
      LEFT JOIN grievance_counts gc ON gc.worker_id = u.id
      LEFT JOIN vulnerability_counts vc ON vc.worker_id = u.id
      WHERE u.role::text = 'WORKER'
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
    `;

    const base = rows.map((row) => ({
      workerId: row.worker_id,
      fullName: row.full_name,
      cityZone: row.city_zone,
      currentNet: toNumber(row.curr_net),
      previousNet: toNumber(row.prev_net),
      incomeDropPct: Math.max(0, toNumber(row.income_drop_pct)),
      commissionPct: Math.max(0, toNumber(row.commission_pct)),
      grievanceCount: toNumber(row.grievance_count),
      unverifiedPct: Math.max(0, toNumber(row.unverified_pct)),
      vulnerabilityCount: toNumber(row.vulnerability_count),
    }));

    const complaintComposite = base.map((worker) => worker.grievanceCount + worker.vulnerabilityCount);

    const incomeDropNorm = normalize(base.map((worker) => worker.incomeDropPct));
    const deductionsNorm = normalize(base.map((worker) => worker.commissionPct));
    const complaintsNorm = normalize(complaintComposite);
    const verificationNorm = normalize(base.map((worker) => worker.unverifiedPct));

    const totalWeight =
      query.incomeDropWeight +
      query.deductionsWeight +
      query.complaintWeight +
      query.verificationWeight;

    const weights = {
      incomeDrop: query.incomeDropWeight / totalWeight,
      deductions: query.deductionsWeight / totalWeight,
      complaints: query.complaintWeight / totalWeight,
      verification: query.verificationWeight / totalWeight,
    };

    const ranked = base
      .map((worker, index) => ({
        ...worker,
        riskScore:
          (incomeDropNorm[index] * weights.incomeDrop +
            deductionsNorm[index] * weights.deductions +
            complaintsNorm[index] * weights.complaints +
            verificationNorm[index] * weights.verification) *
          100,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, query.limit)
      .map((worker, index) => ({
        ...worker,
        rank: index + 1,
      }));

    return c.json({
      insight: 'worker-risk-scores',
      meta: {
        currentFrom: toIsoDate(currentFrom),
        currentTo: toIsoDate(currentTo),
        previousFrom: toIsoDate(previousFrom),
        previousTo: toIsoDate(previousTo),
        cityZone: query.cityZone ?? null,
        weights,
      },
      workers: ranked,
    });
  },
).get(
  '/insights/zone-intelligence',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 12);

    type ZoneIntelligenceRow = {
      city_zone: string;
      platform_id: string;
      platform_name: string;
      worker_count: NumericLike;
      median_net_earned: NumericLike;
      avg_commission_pct: NumericLike;
      grievance_count: NumericLike;
      vulnerability_count: NumericLike;
    };

    const rows: ZoneIntelligenceRow[] = await db.$queryRaw<ZoneIntelligenceRow[]>`
      WITH shift_metrics AS (
        SELECT
          COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
          sl.platform_id,
          COUNT(DISTINCT sl.worker_id)::int AS worker_count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY sl.net_received)::numeric AS median_net_earned,
          AVG(
            CASE
              WHEN sl.gross_earned = 0 THEN 0
              ELSE (sl.platform_deductions / sl.gross_earned) * 100
            END
          )::numeric AS avg_commission_pct
        FROM shift_logs sl
        JOIN "User" u ON u.id = sl.worker_id
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2
      ),
      grievance_metrics AS (
        SELECT
          COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
          g.platform_id,
          COUNT(*)::int AS grievance_count
        FROM grievances g
        LEFT JOIN "User" u ON u.id = g.worker_id
        WHERE g.platform_id IS NOT NULL
          AND g.created_at::date BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1, 2
      ),
      vulnerability_metrics AS (
        SELECT
          COALESCE(u.city_zone, 'UNKNOWN') AS city_zone,
          COUNT(*)::int AS vulnerability_count
        FROM vulnerability_flags vf
        JOIN "User" u ON u.id = vf.worker_id
        WHERE vf.flag_month BETWEEN ${from}::date AND ${to}::date
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
        GROUP BY 1
      )
      SELECT
        sm.city_zone,
        p.id AS platform_id,
        p.name AS platform_name,
        sm.worker_count,
        sm.median_net_earned,
        sm.avg_commission_pct,
        COALESCE(gm.grievance_count, 0)::int AS grievance_count,
        COALESCE(vm.vulnerability_count, 0)::int AS vulnerability_count
      FROM shift_metrics sm
      JOIN platforms p ON p.id = sm.platform_id
      LEFT JOIN grievance_metrics gm
        ON gm.city_zone = sm.city_zone
       AND gm.platform_id = sm.platform_id
      LEFT JOIN vulnerability_metrics vm
        ON vm.city_zone = sm.city_zone
      ORDER BY sm.city_zone ASC, p.name ASC
    `;

    const segments = rows.map((row) => ({
      cityZone: row.city_zone,
      platformId: row.platform_id,
      platformName: row.platform_name,
      workerCount: toNumber(row.worker_count),
      medianNetEarned: toNumber(row.median_net_earned),
      avgCommissionPct: toNumber(row.avg_commission_pct),
      grievanceCount: toNumber(row.grievance_count),
      vulnerabilityCount: toNumber(row.vulnerability_count),
    }));

    return c.json({
      insight: 'zone-intelligence',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZoneFilter: query.cityZone ?? null,
      },
      segments,
    });
  },
).get(
  '/insights/complaint-intelligence',
  zValidator('query', complaintIntelligenceQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 4);

    const grievances: Array<{
      id: string;
      category: string;
      title: string;
      description: string;
      clusterId: string | null;
      platformId: string | null;
    }> = await db.grievance.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
        ...(query.cityZone
          ? {
              worker: {
                cityZone: query.cityZone,
              },
            }
          : {}),
      },
      select: {
        id: true,
        category: true,
        title: true,
        description: true,
        clusterId: true,
        platformId: true,
      },
    });

    type TagRow = {
      tag: string;
      tag_count: NumericLike;
    };

    const tagRows: TagRow[] = await db.$queryRaw<TagRow[]>`
      SELECT
        gt.tag,
        COUNT(*)::int AS tag_count
      FROM grievance_tags gt
      JOIN grievances g ON g.id = gt.grievance_id
      LEFT JOIN "User" u ON u.id = g.worker_id
      WHERE g.created_at::date BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY gt.tag
      ORDER BY tag_count DESC, gt.tag ASC
      LIMIT ${query.topIssues}
    `;

    const categoryMap = new Map<string, number>();
    const clusterMap = new Map<string, number>();
    const platformIssueMap = new Map<string, number>();

    for (const grievance of grievances) {
      const category = grievance.category;
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);

      const clusterKey = grievance.clusterId ?? category;
      clusterMap.set(clusterKey, (clusterMap.get(clusterKey) ?? 0) + 1);

      const platformKey = grievance.platformId ?? 'UNSPECIFIED';
      platformIssueMap.set(platformKey, (platformIssueMap.get(platformKey) ?? 0) + 1);
    }

    const platformIds = [...platformIssueMap.keys()].filter((id) => id !== 'UNSPECIFIED');
    const platforms: Array<{ id: string; name: string }> =
      platformIds.length === 0
        ? []
        : await db.platform.findMany({
            where: {
              id: {
                in: platformIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          });

    const platformNameById = new Map(platforms.map((platform) => [platform.id, platform.name]));

    const topCategories = [...categoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
      .slice(0, query.topIssues);

    const topClusters = [...clusterMap.entries()]
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster))
      .slice(0, query.topIssues);

    const platformIssueHotspots = [...platformIssueMap.entries()]
      .map(([platformId, count]) => ({
        platformId,
        platformName: platformNameById.get(platformId) ?? platformId,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.platformName.localeCompare(b.platformName))
      .slice(0, query.topIssues);

    const topKeywords = extractKeywords(
      grievances.map((grievance) => `${grievance.title} ${grievance.description}`),
      query.topKeywords,
    );

    return c.json({
      insight: 'complaint-intelligence',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      totals: {
        grievanceCount: grievances.length,
      },
      topCategories,
      topClusters,
      topKeywords,
      topTags: tagRows.map((row) => ({
        tag: row.tag,
        count: toNumber(row.tag_count),
      })),
      platformIssueHotspots,
    });
  },
).get(
  '/insights/cohort-analysis',
  zValidator('query', rollingWindowQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 26);

    type CohortTrendRow = {
      cohort_month: Date;
      month_start: Date;
      avg_month_net: NumericLike;
      active_workers: NumericLike;
    };

    const trendRows: CohortTrendRow[] = await db.$queryRaw<CohortTrendRow[]>`
      WITH worker_cohorts AS (
        SELECT
          u.id AS worker_id,
          date_trunc('month', u.created_at)::date AS cohort_month
        FROM "User" u
        WHERE u.role::text = 'WORKER'
          AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      ),
      monthly_income AS (
        SELECT
          sl.worker_id,
          date_trunc('month', sl.shift_date)::date AS month_start,
          SUM(sl.net_received)::numeric AS month_net
        FROM shift_logs sl
        WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1, 2
      )
      SELECT
        wc.cohort_month,
        mi.month_start,
        AVG(mi.month_net)::numeric AS avg_month_net,
        COUNT(DISTINCT mi.worker_id)::int AS active_workers
      FROM worker_cohorts wc
      JOIN monthly_income mi ON mi.worker_id = wc.worker_id
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `;

    const latestMonthStart = new Date(to);
    latestMonthStart.setDate(1);

    const newWorkerCutoff = shiftDays(to, -90);

    type CohortSummaryRow = {
      cohort_type: string;
      avg_month_net: NumericLike;
      worker_count: NumericLike;
    };

    const summaryRows: CohortSummaryRow[] = await db.$queryRaw<CohortSummaryRow[]>`
      WITH latest_month_income AS (
        SELECT
          sl.worker_id,
          SUM(sl.net_received)::numeric AS month_net
        FROM shift_logs sl
        WHERE date_trunc('month', sl.shift_date)::date = date_trunc('month', ${latestMonthStart}::date)
        GROUP BY 1
      )
      SELECT
        CASE
          WHEN u.created_at >= ${newWorkerCutoff}::date THEN 'NEW'
          ELSE 'ESTABLISHED'
        END AS cohort_type,
        AVG(lmi.month_net)::numeric AS avg_month_net,
        COUNT(*)::int AS worker_count
      FROM latest_month_income lmi
      JOIN "User" u ON u.id = lmi.worker_id
      WHERE u.role::text = 'WORKER'
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const trends = trendRows.map((row) => ({
      cohortMonth: toIsoDate(row.cohort_month),
      monthStart: toIsoDate(row.month_start),
      avgMonthNet: toNumber(row.avg_month_net),
      activeWorkers: toNumber(row.active_workers),
    }));

    const summary = summaryRows.map((row) => ({
      cohortType: row.cohort_type,
      avgMonthNet: toNumber(row.avg_month_net),
      workerCount: toNumber(row.worker_count),
    }));

    return c.json({
      insight: 'cohort-analysis',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
      },
      trends,
      summary,
    });
  },
);

analytics.get(
  '/insights/real-hourly-wage',
  zValidator('query', realHourlyWageQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const { from, to } = resolveWindow(query, 16);

    const minWageHourly = query.minWageMonthlyPkr / query.expectedHoursPerMonth;

    if (query.workerId) {
      const worker = await getWorkerContext(query.workerId);

      if (!worker) {
        return c.json({ message: 'Worker not found.' }, 404);
      }

      const cityZone = query.cityZone ?? worker.cityZone ?? null;
      const category = worker.category ?? null;

      type RealHourlyWorkerRow = {
        week_start: Date;
        worker_hourly: NumericLike;
        city_median_hourly: NumericLike;
      };

      const rows: RealHourlyWorkerRow[] = await db.$queryRaw<RealHourlyWorkerRow[]>`
        WITH worker_weekly AS (
          SELECT
            date_trunc('week', sl.shift_date)::date AS week_start,
            CASE
              WHEN SUM(sl.hours_worked) = 0 THEN 0
              ELSE (SUM(sl.net_received) / SUM(sl.hours_worked))::numeric
            END AS worker_hourly
          FROM shift_logs sl
          WHERE sl.worker_id = ${query.workerId}
            AND sl.shift_date BETWEEN ${from}::date AND ${to}::date
          GROUP BY 1
        ),
        city_worker_weekly AS (
          SELECT
            date_trunc('week', sl.shift_date)::date AS week_start,
            sl.worker_id,
            CASE
              WHEN SUM(sl.hours_worked) = 0 THEN NULL
              ELSE (SUM(sl.net_received) / SUM(sl.hours_worked))::numeric
            END AS worker_hourly
          FROM shift_logs sl
          JOIN "User" u ON u.id = sl.worker_id
          WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
            AND (${cityZone}::text IS NULL OR u.city_zone = ${cityZone})
            AND (${category}::text IS NULL OR u.category::text = ${category})
          GROUP BY 1, 2
        ),
        city_weekly_median AS (
          SELECT
            week_start,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY worker_hourly) AS city_median_hourly
          FROM city_worker_weekly
          WHERE worker_hourly IS NOT NULL
          GROUP BY 1
        )
        SELECT
          ww.week_start,
          ww.worker_hourly,
          COALESCE(cwm.city_median_hourly, 0)::numeric AS city_median_hourly
        FROM worker_weekly ww
        LEFT JOIN city_weekly_median cwm ON cwm.week_start = ww.week_start
        ORDER BY ww.week_start ASC
      `;

      const points = rows.map((row) => ({
        weekStart: toIsoDate(row.week_start),
        workerHourly: toNumber(row.worker_hourly),
        cityMedianHourly: toNumber(row.city_median_hourly),
        minWageHourly,
      }));

      return c.json({
        insight: 'real-hourly-wage',
        scope: 'worker',
        meta: {
          workerId: query.workerId,
          cityZone,
          category,
          from: toIsoDate(from),
          to: toIsoDate(to),
          minWageHourly,
        },
        points,
      });
    }

    type RealHourlyPlatformRow = {
      platform_id: string;
      platform_name: string;
      avg_hourly: NumericLike;
    };

    const rows: RealHourlyPlatformRow[] = await db.$queryRaw<RealHourlyPlatformRow[]>`
      SELECT
        p.id AS platform_id,
        p.name AS platform_name,
        CASE
          WHEN SUM(sl.hours_worked) = 0 THEN 0
          ELSE (SUM(sl.net_received) / SUM(sl.hours_worked))::numeric
        END AS avg_hourly
      FROM shift_logs sl
      JOIN platforms p ON p.id = sl.platform_id
      JOIN "User" u ON u.id = sl.worker_id
      WHERE sl.shift_date BETWEEN ${from}::date AND ${to}::date
        AND (${query.cityZone ?? null}::text IS NULL OR u.city_zone = ${query.cityZone ?? null})
      GROUP BY 1, 2
      ORDER BY avg_hourly ASC
    `;

    const platforms = rows.map((row) => ({
      platformId: row.platform_id,
      platformName: row.platform_name,
      avgHourly: toNumber(row.avg_hourly),
      minWageHourly,
      deltaVsMinWage: toNumber(row.avg_hourly) - minWageHourly,
    }));

    return c.json({
      insight: 'real-hourly-wage',
      scope: 'platform',
      meta: {
        from: toIsoDate(from),
        to: toIsoDate(to),
        cityZone: query.cityZone ?? null,
        minWageHourly,
      },
      platforms,
    });
  },
);

export default analytics;
