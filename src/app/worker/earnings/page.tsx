'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import { useGetShifts } from '@/app/worker/log-shift/_api/get-shifts';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { cn } from '@/lib/utils';
import {
  EarningsFilterBar,
  type EarningsFilters,
} from './_components/earnings-filter-bar';
import { EarningsHistory } from './_components/earnings-history';
import { IncomeAnalytics } from './_components/income-analytics';
import { ShiftDetailSheet } from './_components/shift-detail-sheet';

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

const moneyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-PK', {
  style: 'percent',
  maximumFractionDigits: 0,
});

async function parseResponseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

const defaultFilters: EarningsFilters = {
  platform: '',
  status: 'ALL',
  from: '',
  to: '',
};

export default function WorkerEarningsPage() {
  const [filters, setFilters] = useState<EarningsFilters>(defaultFilters);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const trendQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'worker', 'earnings-trend', 12],
    queryFn: async () => {
      const response = await client.api.analytics.worker[':workerId']['earnings-trend'].$get({
        param: { workerId: 'me' },
        query: { weeks: 12 },
      });

      return parseResponseOrThrow<EarningsTrendResponse>(response);
    },
    staleTime: 60_000,
  });

  const queryFilters = useMemo(
    () => ({
      platform: filters.platform || undefined,
      status: filters.status !== 'ALL' ? filters.status : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters],
  );

  const { data, isLoading } = useGetShifts(queryFilters);
  const shifts = useMemo(() => data?.data ?? [], [data]);

  const latestTrendPoint = trendQuery.data?.points?.[trendQuery.data.points.length - 1];
  const latestGap = trendQuery.data?.summary.latestGapToMedian ?? 0;
  const avgGap = trendQuery.data?.summary.avgGapToMedian ?? 0;
  const latestGapTone = latestGap >= 0 ? 'secondary' : 'destructive';
  const latestGapLabel = latestGap >= 0 ? 'Above city median' : 'Below city median';

  const stats = useMemo(() => {
    const totals = shifts.reduce(
      (acc, shift) => {
        const net = Number(shift.netReceived ?? 0);
        const gross = Number(shift.grossEarned ?? 0);
        const deductions = Number(shift.platformDeductions ?? 0);
        const hours = Number(shift.hoursWorked ?? 0);

        acc.totalNet += net;
        acc.totalGross += gross;
        acc.totalDeductions += deductions;
        acc.totalHours += hours;

        if (shift.verificationStatus === 'CONFIRMED') {
          acc.verifiedCount += 1;
        }

        return acc;
      },
      {
        totalNet: 0,
        totalGross: 0,
        totalDeductions: 0,
        totalHours: 0,
        verifiedCount: 0,
      },
    );

    const averageHourlyRate =
      totals.totalHours > 0 ? totals.totalNet / totals.totalHours : 0;

    const verificationRate =
      shifts.length > 0 ? totals.verifiedCount / shifts.length : 0;

    const latestShiftDate =
      shifts.length > 0
        ? shifts.reduce((latest, shift) => {
            const shiftTime = new Date(shift.shiftDate).getTime();
            return shiftTime > latest ? shiftTime : latest;
          }, 0)
        : null;

    return {
      ...totals,
      averageHourlyRate,
      verificationRate,
      latestShiftDate,
    };
  }, [shifts]);

  return (
    <div className='space-y-6 lg:space-y-7'>
      <section className='relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/30 p-5 shadow-sm sm:p-7'>
        <div className='absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/5 blur-3xl' aria-hidden='true' />
        <div className='relative flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
              Earnings Overview
            </h1>
            <p className='max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]'>
              Track verified earnings, monitor hourly performance, and benchmark
              your progress against city median trends.
            </p>

            <div className='flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground'>
              <Badge variant='outline' className='rounded-full px-2.5'>
                {numberFormatter.format(shifts.length)} shifts logged
              </Badge>
              <Badge variant='outline' className='rounded-full px-2.5'>
                {numberFormatter.format(stats.verifiedCount)} verified
              </Badge>
              {stats.latestShiftDate && (
                <span className='inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1'>
                  <CalendarClock className='size-3.5' />
                  Last shift {new Date(stats.latestShiftDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <Link
            href='/worker/log-shift'
            className={cn(buttonVariants(), 'h-10 rounded-full px-5 font-medium')}
          >
            Log a shift
          </Link>
        </div>
      </section>

      <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className='border-border/70'>
                <CardContent className='space-y-2 p-4'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-8 w-32' />
                  <Skeleton className='h-3 w-28' />
                </CardContent>
              </Card>
            ))
          : [
              {
                title: 'Total Received',
                value: moneyFormatter.format(stats.totalNet),
                hint: 'Net payouts across filtered shifts',
                icon: CircleDollarSign,
              },
              {
                title: 'Avg Hourly Rate',
                value: `${moneyFormatter.format(stats.averageHourlyRate)}/hr`,
                hint: `${numberFormatter.format(stats.totalHours)} total hours logged`,
                icon: Clock3,
              },
              {
                title: 'Verified Reliability',
                value: percentFormatter.format(stats.verificationRate),
                hint: `${numberFormatter.format(stats.verifiedCount)} verified shifts`,
                icon: ShieldCheck,
              },
              {
                title: 'Platform Deductions',
                value: moneyFormatter.format(stats.totalDeductions),
                hint:
                  stats.totalGross > 0
                    ? `${percentFormatter.format(stats.totalDeductions / stats.totalGross)} of gross earnings`
                    : 'No deductions recorded yet',
                icon: TrendingUp,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className='border-border/70 bg-card/80 shadow-xs'>
                  <CardContent className='space-y-2 p-4'>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'>
                        {item.title}
                      </p>
                      <span className='inline-flex rounded-md border border-border/70 bg-background/60 p-1.5 text-muted-foreground'>
                        <Icon className='size-4' />
                      </span>
                    </div>
                    <p className='text-xl font-semibold tracking-tight'>{item.value}</p>
                    <p className='text-xs text-muted-foreground'>{item.hint}</p>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      <Card className='border-border/70 shadow-xs'>
        <CardHeader className='space-y-4 border-b border-border/70 bg-muted/20'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base sm:text-lg'>Earnings History</CardTitle>
              <CardDescription>
                Filter by platform, timeframe, and verification status.
              </CardDescription>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>
                {numberFormatter.format(shifts.length)} shifts
              </Badge>
              <Badge variant='outline'>
                {numberFormatter.format(stats.verifiedCount)} verified
              </Badge>
            </div>
          </div>
          <EarningsFilterBar filters={filters} onChange={setFilters} />
        </CardHeader>
        <CardContent>
          <EarningsHistory
            shifts={shifts}
            isLoading={isLoading}
            onSelectShift={setSelectedShiftId}
          />
        </CardContent>
      </Card>

      <div className='grid gap-6 xl:grid-cols-5'>
        <Card className='border-border/70 shadow-xs xl:col-span-3'>
          <CardHeader>
          <CardTitle className='text-base'>Income Analytics</CardTitle>
          <CardDescription>
            Weekly and monthly trends for earnings, hourly rate, and platform deductions.
          </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeAnalytics shifts={shifts} isLoading={isLoading} />
          </CardContent>
        </Card>

        <Card className='border-border/70 shadow-xs xl:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>City Median Benchmark</CardTitle>
            <CardDescription>
              Compare your net earnings against anonymized city-wide worker medians.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendQuery.isLoading ? (
              <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-1'>
                <Skeleton className='h-20 rounded-xl' />
                <Skeleton className='h-20 rounded-xl' />
                <Skeleton className='h-20 rounded-xl' />
              </div>
            ) : trendQuery.isError || !latestTrendPoint ? (
              <p className='rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground'>
                We could not load city median comparison right now.
              </p>
            ) : (
              <div className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-1'>
                  <div className='rounded-xl border border-border/70 bg-muted/20 p-4'>
                    <p className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                      Latest Week You
                    </p>
                    <p className='mt-1 text-lg font-semibold'>
                      {moneyFormatter.format(latestTrendPoint.workerNet)}
                    </p>
                  </div>
                  <div className='rounded-xl border border-border/70 bg-muted/20 p-4'>
                    <p className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                      City Median
                    </p>
                    <p className='mt-1 text-lg font-semibold'>
                      {moneyFormatter.format(latestTrendPoint.cityMedianNet)}
                    </p>
                  </div>
                  <div className='rounded-xl border border-border/70 bg-muted/20 p-4'>
                    <p className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                      Gap
                    </p>
                    <p className='mt-1 text-lg font-semibold'>
                      {latestGap >= 0 ? '+' : '-'}
                      {moneyFormatter.format(Math.abs(latestGap))}
                    </p>
                    <Badge variant={latestGapTone} className='mt-2'>
                      {latestGapLabel}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <p className='text-sm text-muted-foreground'>
                  12-week average gap:{' '}
                  <span className='font-medium text-foreground'>
                    {avgGap >= 0 ? '+' : '-'}
                    {moneyFormatter.format(Math.abs(avgGap))}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ShiftDetailSheet shiftId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
    </div>
  );
}
