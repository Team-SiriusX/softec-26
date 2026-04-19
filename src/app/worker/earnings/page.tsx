'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

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
        query: { weeks: "12" },
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
  const shifts = data?.data ?? [];

  const latestTrendPoint = trendQuery.data?.points?.[trendQuery.data.points.length - 1];
  const latestGap = trendQuery.data?.summary.latestGapToMedian ?? 0;
  const avgGap = trendQuery.data?.summary.avgGapToMedian ?? 0;
  const latestGapTone = latestGap >= 0 ? 'secondary' : 'destructive';
  const latestGapLabel = latestGap >= 0 ? 'Above city median' : 'Below city median';

  const verifiedCount = shifts.filter(
    (shift) => shift.verificationStatus === 'CONFIRMED',
  ).length;

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>My Earnings</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            View your shift history, status badges, and income trends over time.
          </p>
        </div>
        <Link href='/worker/log-shift' className={buttonVariants()}>
          Log a shift
        </Link>
      </div>

      <Card>
        <CardHeader className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>Earnings History</CardTitle>
              <CardDescription>
                Filter by platform, date range, and verification status.
              </CardDescription>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>{shifts.length} shifts</Badge>
              <Badge variant='outline'>{verifiedCount} verified</Badge>
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

      <Separator />

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>City Median Benchmark</CardTitle>
          <CardDescription>
            Compare your net earnings against anonymized city-wide worker medians.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendQuery.isLoading ? (
            <div className='grid gap-3 sm:grid-cols-3'>
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
              <div className='grid gap-3 sm:grid-cols-3'>
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

              <p className='text-sm text-muted-foreground'>
                12-week average gap: <span className='font-medium text-foreground'>
                  {avgGap >= 0 ? '+' : '-'}{moneyFormatter.format(Math.abs(avgGap))}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ShiftDetailSheet shiftId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
    </div>
  );
}
