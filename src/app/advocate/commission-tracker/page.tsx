'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QUERY_KEYS } from '@/constants/query-keys';
import { cn } from '@/lib/utils';

type CommissionHeatmapResponse = {
  cells: Array<{
    weekStart: string;
    platformId: string;
    platformName: string;
    avgCommissionPct: number;
  }>;
};

type DynamicRow = {
  weekStart: string;
  [key: string]: string | number;
};

const COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e'];

function formatWeekLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
  });
}

export default function CommissionTrackerPage() {
  const [platformFilter, setPlatformFilter] = useState('');

  const query = useQuery<CommissionHeatmapResponse>({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'commission-heatmap', 24],
    queryFn: async () => {
      const response = await fetch('/api/analytics/advocate/commission-rate-heatmap?weeks=24', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load commission tracker data');
      }

      return response.json() as Promise<CommissionHeatmapResponse>;
    },
    staleTime: 60_000,
  });

  const prepared = useMemo(() => {
    const cells = query.data?.cells ?? [];

    const platformStats = new Map<string, {
      platformId: string;
      platformName: string;
      values: number[];
    }>();

    const rowMap = new Map<string, DynamicRow>();

    for (const cell of cells) {
      const stat =
        platformStats.get(cell.platformId) ?? {
          platformId: cell.platformId,
          platformName: cell.platformName,
          values: [],
        };

      stat.values.push(cell.avgCommissionPct);
      platformStats.set(cell.platformId, stat);

      const row = rowMap.get(cell.weekStart) ?? { weekStart: cell.weekStart };
      row[cell.platformId] = cell.avgCommissionPct;
      rowMap.set(cell.weekStart, row);
    }

    const platforms = [...platformStats.values()].map((platform) => {
      const values = [...platform.values].sort((a, b) => a - b);
      const mean = values.reduce((acc, value) => acc + value, 0) / Math.max(1, values.length);
      const median =
        values.length === 0
          ? 0
          : values.length % 2 === 0
            ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
            : values[Math.floor(values.length / 2)];

      return {
        platformId: platform.platformId,
        platformName: platform.platformName,
        mean,
        median,
        min: values[0] ?? 0,
        max: values.at(-1) ?? 0,
        points: values.length,
      };
    }).sort((a, b) => b.mean - a.mean);

    const normalizedFilter = platformFilter.trim().toLowerCase();

    const filteredPlatforms =
      normalizedFilter.length === 0
        ? platforms
        : platforms.filter((platform) =>
            platform.platformName.toLowerCase().includes(normalizedFilter),
          );

    const selectedTop = filteredPlatforms.slice(0, 4);
    const selectedIds = new Set(selectedTop.map((platform) => platform.platformId));

    const trendRows = [...rowMap.values()]
      .sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)))
      .map((row) => {
        const next: DynamicRow = { weekStart: String(row.weekStart) };
        for (const platform of selectedTop) {
          next[platform.platformId] = Number(row[platform.platformId] ?? 0);
        }
        return next;
      });

    const distributionRows = filteredPlatforms.map((platform) => ({
      platformName: platform.platformName,
      median: Number(platform.median.toFixed(2)),
      mean: Number(platform.mean.toFixed(2)),
    }));

    return {
      filteredPlatforms,
      selectedTop,
      trendRows,
      distributionRows,
      selectedIds,
    };
  }, [platformFilter, query.data?.cells]);

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_95%_6%,rgba(34,197,94,0.13),transparent_34%),radial-gradient(circle_at_6%_6%,rgba(14,165,233,0.12),transparent_36%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='gap-4 md:flex-row md:items-end md:justify-between'>
            <div className='space-y-2'>
              <Badge variant='outline'>Phase 6.3</Badge>
              <CardTitle className='text-3xl tracking-tight'>Platform Commission Tracker</CardTitle>
              <CardDescription className='max-w-3xl'>
                Distribution-first commission analytics by platform, with trend and median views for exposing outlier events.
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Link href='/advocate/dashboard' className={cn(buttonVariants({ variant: 'outline' }))}>
                Back To Dashboard
              </Link>
              <Link href='/advocate/vulnerability-flags' className={cn(buttonVariants({ variant: 'default' }))}>
                Open Vulnerability Detail
                <ArrowRight className='size-4' />
              </Link>
            </div>
          </CardHeader>
        </Card>

        <Card className='border-border/60 bg-card/90'>
          <CardContent className='flex flex-wrap items-center gap-3 pt-6'>
            <Input
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              placeholder='Filter by platform name'
              className='w-full sm:max-w-xs'
            />
            <Badge variant='secondary'>24 week window</Badge>
            <Badge variant='outline'>Distribution includes mean, median, min, max</Badge>
          </CardContent>
        </Card>

        <section className='grid gap-6 xl:grid-cols-2'>
          <Card className='border-border/60 bg-card/90'>
            <CardHeader>
              <CardTitle className='text-base'>Commission trend by platform</CardTitle>
              <CardDescription>Top filtered platforms by mean commission rate.</CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className='h-72 w-full rounded-3xl' />
              ) : query.isError ? (
                <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
                  Failed to load commission trends.
                </div>
              ) : prepared.selectedTop.length === 0 ? (
                <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
                  No platform trend data for current filter.
                </div>
              ) : (
                <div className='h-72 w-full'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={prepared.trendRows} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray='4 4' />
                      <XAxis dataKey='weekStart' tickFormatter={formatWeekLabel} minTickGap={20} />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Commission']}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                      />
                      {prepared.selectedTop.map((platform, index) => (
                        <Line
                          key={platform.platformId}
                          dataKey={platform.platformId}
                          name={platform.platformName}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2.4}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='border-border/60 bg-card/90'>
            <CardHeader>
              <CardTitle className='text-base'>Commission distribution (median-focused)</CardTitle>
              <CardDescription>Median rate by platform to avoid average-only blind spots.</CardDescription>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className='h-72 w-full rounded-3xl' />
              ) : query.isError ? (
                <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
                  Failed to load distribution chart.
                </div>
              ) : prepared.distributionRows.length === 0 ? (
                <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
                  No distribution data for current filter.
                </div>
              ) : (
                <div className='h-72 w-full'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart
                      data={[...prepared.distributionRows].slice(0, 10)}
                      layout='vertical'
                      margin={{ left: 20, right: 16 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray='4 4' />
                      <XAxis type='number' tickFormatter={(value) => `${value}%`} />
                      <YAxis type='category' dataKey='platformName' width={112} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                      <Bar dataKey='median' fill='#14b8a6' radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className='border-border/60 bg-card/90'>
          <CardHeader>
            <CardTitle className='text-base'>Platform commission distribution table</CardTitle>
            <CardDescription>Includes min, median, mean, and max over the selected 24-week window.</CardDescription>
          </CardHeader>
          <CardContent>
            {query.isLoading ? (
              <Skeleton className='h-80 w-full rounded-3xl' />
            ) : query.isError ? (
              <div className='flex h-80 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
                Failed to load commission distribution table.
              </div>
            ) : prepared.filteredPlatforms.length === 0 ? (
              <div className='flex h-56 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
                No platforms match the current filter.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Median</TableHead>
                    <TableHead>Mean</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prepared.filteredPlatforms.map((platform) => (
                    <TableRow key={platform.platformId}>
                      <TableCell className='font-medium'>{platform.platformName}</TableCell>
                      <TableCell>{platform.min.toFixed(1)}%</TableCell>
                      <TableCell>{platform.median.toFixed(1)}%</TableCell>
                      <TableCell>{platform.mean.toFixed(1)}%</TableCell>
                      <TableCell>{platform.max.toFixed(1)}%</TableCell>
                      <TableCell>{platform.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
