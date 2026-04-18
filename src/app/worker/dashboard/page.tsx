'use client';

import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { QUERY_KEYS } from '@/constants/query-keys';
import { useCurrentUser } from '@/hooks/use-current-user';
import { client } from '@/lib/hono';
import { cn } from '@/lib/utils';
import { AnomalyAlertCard } from './_components/anomaly-alert-card';

type EarningsTrendResponse = {
  summary: {
    avgGapToMedian: number;
    latestGapToMedian: number;
  };
  points: Array<{
    weekStart: string;
    workerNet: number;
    cityMedianNet: number;
    gapToMedian: number;
  }>;
};

type HourlyRateRiverResponse = {
  points: Array<{
    weekStart: string;
    workerHourly: number;
    p25: number;
    median: number;
    p75: number;
    status: 'inside' | 'below' | 'above';
  }>;
};

type CommissionTrackerResponse = {
  points: Array<{
    weekStart: string;
    platformId: string;
    platformName: string;
    commissionPct: number;
  }>;
  seriesByPlatform: Array<{
    platformId: string;
    platformName: string;
    points: Array<{
      weekStart: string;
      commissionPct: number;
    }>;
  }>;
};

type PlatformBreakdownResponse = {
  points: Array<{
    monthStart: string;
    platformId: string;
    platformName: string;
    netEarned: number;
  }>;
};

type DotPlotResponse = {
  workerPoints: Array<{
    shiftDate: string;
    hoursWorked: number;
    netEarned: number;
    platformName: string;
  }>;
  cityPoints: Array<{
    shiftDate: string;
    hoursWorked: number;
    netEarned: number;
    platformName: string;
  }>;
};

type VerificationDonutResponse = {
  total: number;
  points: Array<{
    status: 'CONFIRMED' | 'PENDING' | 'FLAGGED' | 'UNVERIFIABLE';
    count: number;
  }>;
};

type WorkerDetectResponse = {
  anomalies?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    explanation: string;
  }>;
  flags?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    explanation: string;
  }>;
};

type DynamicRow = {
  period: string;
  [key: string]: number | string | null;
};

const currencyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat('en-PK', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 1,
});

const COMMISSION_PALETTE = [
  '#0ea5e9',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#22c55e',
];

const DONUT_STATUS_COLORS: Record<
  VerificationDonutResponse['points'][number]['status'],
  string
> = {
  CONFIRMED: '#16a34a',
  PENDING: '#f59e0b',
  FLAGGED: '#ef4444',
  UNVERIFIABLE: '#6b7280',
};

const WORKER_WINDOW_OPTIONS = [8, 16, 24, 52] as const;
type WorkerWindowWeeks = (typeof WORKER_WINDOW_OPTIONS)[number];

async function parseResponseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function formatMoney(value: number) {
  return currencyFormatter.format(value);
}

function formatCompactMoney(value: number) {
  return compactNumberFormatter.format(value);
}

function formatPct(value: number) {
  return `${percentFormatter.format(value)}%`;
}

function formatWeekLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMonthLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    year: '2-digit',
  });
}

function getStatusTone(
  status: HourlyRateRiverResponse['points'][number]['status'],
) {
  if (status === 'below') {
    return 'destructive';
  }

  if (status === 'above') {
    return 'secondary';
  }

  return 'outline';
}

function ChartCard({
  title,
  description,
  loading,
  error,
  empty = false,
  emptyMessage = 'No data in the selected window yet.',
  className,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'border-border/60 bg-card/90 shadow-sm backdrop-blur transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
    >
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className='h-[320px] w-full rounded-3xl' />
        ) : error ? (
          <div className='border-destructive/40 bg-destructive/5 text-destructive flex h-[320px] items-center justify-center rounded-3xl border border-dashed px-4 text-center text-sm'>
            Unable to load this chart right now.
          </div>
        ) : empty ? (
          <div className='border-border/70 bg-muted/20 text-muted-foreground flex h-[320px] items-center justify-center rounded-3xl border border-dashed px-4 text-center text-sm'>
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkerAnalyticsPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [windowWeeks, setWindowWeeks] = useState<WorkerWindowWeeks>(24);
  const breakdownMonths = Math.min(12, Math.max(3, Math.ceil(windowWeeks / 4)));
  const distributionWeeks = Math.min(windowWeeks, 52);

  const earningsTrendQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'worker', 'earnings-trend', windowWeeks],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'earnings-trend'
      ].$get({
        param: { workerId: 'me' },
        query: { weeks: String(windowWeeks) },
      });

      return parseResponseOrThrow<EarningsTrendResponse>(response);
    },
    staleTime: 60_000,
  });

  const hourlyRateRiverQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'worker',
      'hourly-rate-river',
      windowWeeks,
    ],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'hourly-rate-river'
      ].$get({
        param: { workerId: 'me' },
        query: { weeks: String(windowWeeks) },
      });

      return parseResponseOrThrow<HourlyRateRiverResponse>(response);
    },
    staleTime: 60_000,
  });

  const commissionTrackerQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'worker',
      'commission-rate-tracker',
      windowWeeks,
    ],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'commission-rate-tracker'
      ].$get({
        param: { workerId: 'me' },
        query: { weeks: String(windowWeeks) },
      });

      return parseResponseOrThrow<CommissionTrackerResponse>(response);
    },
    staleTime: 60_000,
  });

  const platformBreakdownQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'worker',
      'platform-breakdown',
      breakdownMonths,
    ],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'platform-earnings-breakdown'
      ].$get({
        param: { workerId: 'me' },
        query: { months: String(breakdownMonths) },
      });

      return parseResponseOrThrow<PlatformBreakdownResponse>(response);
    },
    staleTime: 60_000,
  });

  const distributionQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'worker',
      'distribution',
      distributionWeeks,
    ],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'earnings-distribution-dot-plot'
      ].$get({
        param: { workerId: 'me' },
        query: { weeks: String(distributionWeeks) },
      });

      return parseResponseOrThrow<DotPlotResponse>(response);
    },
    staleTime: 60_000,
  });

  const verificationQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'worker', 'verification', windowWeeks],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId'][
        'verification-status-donut'
      ].$get({
        param: { workerId: 'me' },
        query: { weeks: String(windowWeeks) },
      });

      return parseResponseOrThrow<VerificationDonutResponse>(response);
    },
    staleTime: 60_000,
  });

  const anomalyQuery = useQuery({
    queryKey: [QUERY_KEYS.ANOMALY, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const response = await client.api.anomaly.detect.$post({
        json: { workerId: user?.id ?? '' },
      });

      return parseResponseOrThrow<WorkerDetectResponse>(response);
    },
    staleTime: 60_000,
  });

  const queries = [
    earningsTrendQuery,
    hourlyRateRiverQuery,
    commissionTrackerQuery,
    platformBreakdownQuery,
    distributionQuery,
    verificationQuery,
  ];

  const hasAnyError = queries.some((query) => query.isError);

  const earningsTrendEnhanced = useMemo(() => {
    const points = earningsTrendQuery.data?.points ?? [];

    return points.map((point, index) => {
      const lookback = points.slice(Math.max(0, index - 2), index + 1);
      const rollingAverage =
        lookback.length === 0
          ? point.workerNet
          : lookback.reduce((sum, item) => sum + item.workerNet, 0) /
            lookback.length;

      return {
        ...point,
        rollingAverage,
      };
    });
  }, [earningsTrendQuery.data?.points]);

  const hourlyRiverWithBand = useMemo(
    () =>
      (hourlyRateRiverQuery.data?.points ?? []).map((point) => ({
        ...point,
        band: Math.max(0, point.p75 - point.p25),
      })),
    [hourlyRateRiverQuery.data?.points],
  );

  const commissionSeries = useMemo(() => {
    const platforms = commissionTrackerQuery.data?.seriesByPlatform ?? [];
    const rowsMap = new Map<string, DynamicRow>();

    for (const platform of platforms) {
      for (const point of platform.points) {
        const row = rowsMap.get(point.weekStart) ?? { period: point.weekStart };
        row[platform.platformId] = point.commissionPct;
        rowsMap.set(point.weekStart, row);
      }
    }

    const rows = [...rowsMap.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );

    for (const row of rows) {
      for (const platform of platforms) {
        if (typeof row[platform.platformId] === 'undefined') {
          row[platform.platformId] = null;
        }
      }
    }

    return { rows, platforms };
  }, [commissionTrackerQuery.data?.seriesByPlatform]);

  const commissionChartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    commissionSeries.platforms.forEach((platform, index) => {
      config[platform.platformId] = {
        label: platform.platformName,
        color: COMMISSION_PALETTE[index % COMMISSION_PALETTE.length],
      };
    });

    return config;
  }, [commissionSeries.platforms]);

  const platformBreakdownSeries = useMemo(() => {
    const points = platformBreakdownQuery.data?.points ?? [];
    const rowsMap = new Map<string, DynamicRow>();
    const platformMap = new Map<string, string>();

    for (const point of points) {
      platformMap.set(point.platformId, point.platformName);
      const row = rowsMap.get(point.monthStart) ?? { period: point.monthStart };
      row[point.platformId] = point.netEarned;
      rowsMap.set(point.monthStart, row);
    }

    const rows = [...rowsMap.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );

    const platforms = [...platformMap.entries()].map(([id, name]) => ({
      id,
      name,
    }));

    for (const row of rows) {
      for (const platform of platforms) {
        if (typeof row[platform.id] === 'undefined') {
          row[platform.id] = 0;
        }
      }
    }

    return { rows, platforms };
  }, [platformBreakdownQuery.data?.points]);

  const breakdownChartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    platformBreakdownSeries.platforms.forEach((platform, index) => {
      config[platform.id] = {
        label: platform.name,
        color: COMMISSION_PALETTE[index % COMMISSION_PALETTE.length],
      };
    });

    config.totalNet = {
      label: 'Monthly Total',
      color: '#0f172a',
    };

    return config;
  }, [platformBreakdownSeries.platforms]);

  const breakdownRowsWithTotal = useMemo(
    () =>
      platformBreakdownSeries.rows.map((row) => {
        const totalNet = platformBreakdownSeries.platforms.reduce(
          (sum, platform) => sum + Number(row[platform.id] ?? 0),
          0,
        );

        return {
          ...row,
          totalNet,
        };
      }),
    [platformBreakdownSeries.rows, platformBreakdownSeries.platforms],
  );

  const distributionWithSize = useMemo(() => {
    const workerPoints = distributionQuery.data?.workerPoints ?? [];
    const cityPoints = distributionQuery.data?.cityPoints ?? [];

    const allValues = [...workerPoints, ...cityPoints].map(
      (point) => point.netEarned,
    );
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);
    const range = Math.max(1, max - min);

    const withSize = <T extends DotPlotResponse['workerPoints'][number]>(
      points: T[],
    ) => {
      return points.map((point) => ({
        ...point,
        pointSize: 60 + ((point.netEarned - min) / range) * 180,
      }));
    };

    return {
      workerPoints: withSize(workerPoints),
      cityPoints: withSize(cityPoints),
    };
  }, [
    distributionQuery.data?.cityPoints,
    distributionQuery.data?.workerPoints,
  ]);

  const verificationTotal = verificationQuery.data?.total ?? 0;

  const confirmationRate = useMemo(() => {
    if (!verificationQuery.data || verificationTotal === 0) {
      return 0;
    }

    const confirmed =
      verificationQuery.data.points.find(
        (point) => point.status === 'CONFIRMED',
      )?.count ?? 0;

    return (confirmed / verificationTotal) * 100;
  }, [verificationQuery.data, verificationTotal]);

  const latestHourlyStatus = hourlyRateRiverQuery.data?.points.at(-1)?.status;
  const latestHourlyPoint = hourlyRateRiverQuery.data?.points.at(-1);
  const hasSparseSeries =
    earningsTrendEnhanced.length < 4 ||
    commissionSeries.rows.length < 4 ||
    hourlyRiverWithBand.length < 4;

  const anomalies = anomalyQuery.data?.anomalies ?? anomalyQuery.data?.flags ?? [];

  const keyStats = [
    {
      title: 'Latest Gap To Median',
      value: formatMoney(
        earningsTrendQuery.data?.summary.latestGapToMedian ?? 0,
      ),
      detail:
        (earningsTrendQuery.data?.summary.latestGapToMedian ?? 0) >= 0
          ? 'You are above city median this week'
          : 'You are below city median this week',
      icon: TrendingUp,
    },
    {
      title: 'Band Position',
      value: latestHourlyStatus?.toUpperCase() ?? 'N/A',
      detail: 'Hourly position against city p25-p75 band',
      icon: Gauge,
    },
    {
      title: 'Verification Confidence',
      value: `${percentFormatter.format(confirmationRate)}%`,
      detail: 'Share of confirmed shifts in selected window',
      icon: ShieldCheck,
    },
  ];

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%),radial-gradient(circle_at_90%_80%,_rgba(20,184,166,0.12),_transparent_45%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <section className='animate-in fade-in slide-in-from-top-4 duration-500'>
          <Card className='border-border/60 bg-card/95 shadow-md backdrop-blur'>
            <CardHeader className='gap-4 md:flex-row md:items-end md:justify-between'>
              <div className='space-y-2'>
                <Badge variant='outline'>Worker Analytics Lab</Badge>
                <CardTitle className='text-3xl font-semibold tracking-tight'>
                  Earnings Intelligence Dashboard
                </CardTitle>
                <CardDescription className='text-muted-foreground max-w-3xl text-sm'>
                  This page is now the dedicated analytics surface. The
                  operational dashboard remains lightweight while deep trend
                  analysis, outlier detection, and trust metrics live here.
                </CardDescription>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Link
                  href='/worker/dashboard'
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  Back To Dashboard
                </Link>
                <Link
                  href='/worker/log-shift'
                  className={cn(buttonVariants({ variant: 'default' }))}
                >
                  Log Shift
                  <ArrowRight className='size-4' />
                </Link>
              </div>
            </CardHeader>
          </Card>
        </section>

        <section className='grid gap-4 md:grid-cols-3'>
          {anomalies.length > 0 ? (
            <div className='md:col-span-3'>
              <AnomalyAlertCard anomalies={anomalies} />
            </div>
          ) : null}

          <Card className='border-border/60 bg-card/90 md:col-span-3'>
            <CardContent className='flex flex-wrap items-center gap-3 pt-6'>
              <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                Analytics window
              </p>
              {WORKER_WINDOW_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type='button'
                  size='sm'
                  variant={option === windowWeeks ? 'default' : 'outline'}
                  onClick={() => setWindowWeeks(option)}
                >
                  {option} weeks
                </Button>
              ))}
              {hasSparseSeries ? (
                <Badge variant='secondary'>
                  Sparse history detected: add more shift logs for smoother
                  trend geometry.
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {keyStats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <Card
                key={stat.title}
                className={cn(
                  'animate-in fade-in slide-in-from-bottom-3 border-border/60 bg-card/90 duration-500',
                  index === 1 && 'delay-100',
                  index === 2 && 'delay-200',
                )}
              >
                <CardHeader className='pb-3'>
                  <CardDescription className='flex items-center gap-2 text-xs tracking-wide uppercase'>
                    <Icon className='text-primary size-4' />
                    {stat.title}
                  </CardDescription>
                  <CardTitle className='text-2xl'>{stat.value}</CardTitle>
                </CardHeader>
                <CardContent className='text-muted-foreground pt-0 text-sm'>
                  {stat.detail}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {hasAnyError ? (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardHeader>
              <CardTitle className='text-destructive flex items-center gap-2 text-base'>
                <AlertTriangle className='size-4' />
                Some analytics feeds failed
              </CardTitle>
              <CardDescription>
                One or more charts failed to load. You can retry without leaving
                the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant='destructive'
                onClick={() => {
                  void queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.ANALYTICS],
                  });
                }}
              >
                Retry Analytics Fetch
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className='grid gap-6 xl:grid-cols-2'>
          <ChartCard
            title='Earnings Trend'
            description='Weekly net earnings compared against city median.'
            loading={earningsTrendQuery.isLoading}
            error={earningsTrendQuery.isError}
            empty={(earningsTrendQuery.data?.points.length ?? 0) === 0}
            emptyMessage='Add a few logged shifts to unlock weekly earnings trend analysis.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700'
          >
            <ChartContainer
              className='h-[320px] w-full'
              config={{
                workerNet: { label: 'Your Net', color: '#0284c7' },
                cityMedianNet: { label: 'City Median', color: '#475569' },
                rollingAverage: { label: 'Rolling Average', color: '#16a34a' },
              }}
            >
              <AreaChart data={earningsTrendEnhanced} margin={{ left: 8 }}>
                <defs>
                  <linearGradient
                    id='workerNetFill'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='0%'
                      stopColor='var(--color-workerNet)'
                      stopOpacity={0.5}
                    />
                    <stop
                      offset='95%'
                      stopColor='var(--color-workerNet)'
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis
                  dataKey='weekStart'
                  tickFormatter={formatWeekLabel}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {earningsTrendEnhanced.length > 0 ? (
                  <ReferenceLine
                    y={
                      earningsTrendEnhanced[earningsTrendEnhanced.length - 1]
                        .cityMedianNet
                    }
                    stroke='var(--color-cityMedianNet)'
                    strokeOpacity={0.45}
                    strokeDasharray='3 5'
                  />
                ) : null}
                <Area
                  dataKey='workerNet'
                  type='monotone'
                  fill='url(#workerNetFill)'
                  stroke='var(--color-workerNet)'
                  strokeWidth={2.5}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  dataKey='cityMedianNet'
                  type='monotone'
                  stroke='var(--color-cityMedianNet)'
                  strokeDasharray='8 5'
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  dataKey='rollingAverage'
                  type='monotone'
                  stroke='var(--color-rollingAverage)'
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Brush
                  dataKey='weekStart'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatWeekLabel}
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Hourly Rate River'
            description='Your line versus the p25-p75 city band over rolling weeks.'
            loading={hourlyRateRiverQuery.isLoading}
            error={hourlyRateRiverQuery.isError}
            empty={(hourlyRateRiverQuery.data?.points.length ?? 0) === 0}
            emptyMessage='Hourly benchmark appears after enough weekly shifts are available.'
            className='animate-in fade-in slide-in-from-bottom-4 delay-100 duration-700'
          >
            <div className='mb-4 flex flex-wrap gap-2'>
              {(hourlyRateRiverQuery.data?.points ?? [])
                .slice(-4)
                .map((point) => (
                  <Badge
                    key={point.weekStart}
                    variant={getStatusTone(point.status)}
                  >
                    {formatWeekLabel(point.weekStart)}: {point.status}
                  </Badge>
                ))}
            </div>

            <ChartContainer
              className='h-[290px] w-full'
              config={{
                band: { label: 'City Interquartile Band', color: '#7dd3fc' },
                workerHourly: { label: 'Your Hourly', color: '#0f766e' },
                median: { label: 'City Median', color: '#1d4ed8' },
              }}
            >
              <AreaChart data={hourlyRiverWithBand} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis
                  dataKey='weekStart'
                  tickFormatter={formatWeekLabel}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {latestHourlyPoint ? (
                  <ReferenceLine
                    y={latestHourlyPoint.workerHourly}
                    stroke='var(--color-workerHourly)'
                    strokeOpacity={0.35}
                    strokeDasharray='4 5'
                  />
                ) : null}
                <Area
                  dataKey='p25'
                  stackId='band'
                  stroke='transparent'
                  fill='transparent'
                  isAnimationActive
                  animationDuration={900}
                />
                <Area
                  dataKey='band'
                  stackId='band'
                  stroke='transparent'
                  fill='var(--color-band)'
                  fillOpacity={0.35}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  dataKey='workerHourly'
                  type='monotone'
                  stroke='var(--color-workerHourly)'
                  strokeWidth={2.8}
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  dataKey='median'
                  type='monotone'
                  stroke='var(--color-median)'
                  strokeDasharray='6 4'
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Brush
                  dataKey='weekStart'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatWeekLabel}
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Commission Rate Tracker'
            description='Platform-by-platform commission movements across weeks.'
            loading={commissionTrackerQuery.isLoading}
            error={commissionTrackerQuery.isError}
            empty={
              commissionSeries.rows.length === 0 ||
              commissionSeries.platforms.length === 0
            }
            emptyMessage='No platform commission records found in this timeframe.'
            className='animate-in fade-in slide-in-from-bottom-4 delay-200 duration-700'
          >
            <ChartContainer
              className='h-[320px] w-full'
              config={commissionChartConfig}
            >
              <LineChart data={commissionSeries.rows} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis
                  dataKey='period'
                  tickFormatter={formatWeekLabel}
                  minTickGap={24}
                />
                <YAxis tickFormatter={(value) => formatPct(Number(value))} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <ReferenceLine
                  y={30}
                  stroke='#ef4444'
                  strokeOpacity={0.35}
                  strokeDasharray='4 5'
                />
                {commissionSeries.platforms.map((platform, index) => (
                  <Line
                    key={platform.platformId}
                    dataKey={platform.platformId}
                    name={platform.platformName}
                    type='monotone'
                    stroke={
                      COMMISSION_PALETTE[index % COMMISSION_PALETTE.length]
                    }
                    strokeWidth={2.4}
                    dot={false}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Brush
                  dataKey='period'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatWeekLabel}
                />
              </LineChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Platform Earnings Breakdown'
            description='Stacked monthly earnings to reveal platform concentration.'
            loading={platformBreakdownQuery.isLoading}
            error={platformBreakdownQuery.isError}
            empty={
              platformBreakdownSeries.rows.length === 0 ||
              platformBreakdownSeries.platforms.length === 0
            }
            emptyMessage='Monthly platform mix appears once shift history spans multiple periods.'
            className='animate-in fade-in slide-in-from-bottom-4 delay-300 duration-700'
          >
            <ChartContainer
              className='h-[320px] w-full'
              config={breakdownChartConfig}
            >
              <ComposedChart
                data={breakdownRowsWithTotal}
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis dataKey='period' tickFormatter={formatMonthLabel} />
                <YAxis
                  yAxisId='left'
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                />
                <YAxis
                  yAxisId='right'
                  orientation='right'
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {platformBreakdownSeries.platforms.map((platform, index) => (
                  <Bar
                    key={platform.id}
                    yAxisId='left'
                    dataKey={platform.id}
                    name={platform.name}
                    stackId='earnings'
                    fill={COMMISSION_PALETTE[index % COMMISSION_PALETTE.length]}
                    radius={index === 0 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Line
                  yAxisId='right'
                  type='monotone'
                  dataKey='totalNet'
                  name='Monthly Total'
                  stroke='var(--color-totalNet)'
                  strokeWidth={2.3}
                  dot={{ r: 3 }}
                  isAnimationActive
                  animationDuration={900}
                />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Earnings Distribution Dot Plot'
            description='Shift-level outliers: city points in the background, worker points in focus.'
            loading={distributionQuery.isLoading}
            error={distributionQuery.isError}
            empty={
              (distributionQuery.data?.workerPoints.length ?? 0) +
                (distributionQuery.data?.cityPoints.length ?? 0) ===
              0
            }
            emptyMessage='Dot plot appears after shift logs are available for you and city peers.'
            className='animate-in fade-in slide-in-from-bottom-4 delay-400 duration-700'
          >
            <ChartContainer
              className='h-[320px] w-full'
              config={{
                city: { label: 'City', color: '#94a3b8' },
                worker: { label: 'You', color: '#0f766e' },
              }}
            >
              <ScatterChart margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray='4 4' />
                <XAxis
                  type='number'
                  dataKey='hoursWorked'
                  name='Hours Worked'
                  tickFormatter={(value) => String(value)}
                />
                <YAxis
                  type='number'
                  dataKey='netEarned'
                  name='Net Earned'
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                />
                <ZAxis type='number' dataKey='pointSize' range={[40, 260]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Scatter
                  name='City'
                  data={distributionWithSize.cityPoints}
                  fill='var(--color-city)'
                  fillOpacity={0.25}
                  isAnimationActive
                  animationDuration={900}
                />
                <Scatter
                  name='You'
                  data={distributionWithSize.workerPoints}
                  fill='var(--color-worker)'
                  isAnimationActive
                  animationDuration={900}
                />
              </ScatterChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Verification Status Donut'
            description='Trust signal for claim confidence across your logged shifts.'
            loading={verificationQuery.isLoading}
            error={verificationQuery.isError}
            empty={verificationTotal === 0}
            emptyMessage='Verification donut appears when at least one shift exists in range.'
            className='animate-in fade-in slide-in-from-bottom-4 delay-500 duration-700'
          >
            <div className='mb-3 flex items-center justify-between'>
              <p className='text-muted-foreground text-sm'>
                Total shifts:{' '}
                <span className='font-semibold'>{verificationTotal}</span>
              </p>
              <Badge variant='outline'>
                Confirmed: {formatPct(confirmationRate)}
              </Badge>
            </div>

            <div className='relative'>
              <ChartContainer
                className='h-[290px] w-full'
                config={{
                  CONFIRMED: {
                    label: 'Confirmed',
                    color: DONUT_STATUS_COLORS.CONFIRMED,
                  },
                  PENDING: {
                    label: 'Pending',
                    color: DONUT_STATUS_COLORS.PENDING,
                  },
                  FLAGGED: {
                    label: 'Flagged',
                    color: DONUT_STATUS_COLORS.FLAGGED,
                  },
                  UNVERIFIABLE: {
                    label: 'Unverifiable',
                    color: DONUT_STATUS_COLORS.UNVERIFIABLE,
                  },
                }}
              >
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey='status' />}
                  />
                  <Pie
                    data={verificationQuery.data?.points ?? []}
                    dataKey='count'
                    nameKey='status'
                    innerRadius={64}
                    outerRadius={104}
                    paddingAngle={3}
                    isAnimationActive
                    animationDuration={900}
                  >
                    {(verificationQuery.data?.points ?? []).map((point) => (
                      <Cell
                        key={point.status}
                        fill={DONUT_STATUS_COLORS[point.status]}
                      />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
              <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                <p className='text-2xl font-semibold tracking-tight'>
                  {percentFormatter.format(confirmationRate)}%
                </p>
                <p className='text-muted-foreground text-xs tracking-wide uppercase'>
                  trust score
                </p>
              </div>
            </div>
          </ChartCard>
        </section>
      </div>
    </main>
  );
}
