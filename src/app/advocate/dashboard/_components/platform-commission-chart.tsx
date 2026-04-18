'use client';

import { useMemo } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetPlatformStats } from '../_api/get-platform-stats';

type DynamicPoint = {
  weekStart: string;
  [key: string]: number | string;
};

const COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatWeekLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
  });
}

export function PlatformCommissionChart() {
  const query = useGetPlatformStats();

  const series = useMemo(() => {
    const cells = query.data?.cells ?? [];
    const platformTotals = new Map<string, number>();

    for (const cell of cells) {
      platformTotals.set(
        cell.platformName,
        (platformTotals.get(cell.platformName) ?? 0) + cell.avgCommissionPct,
      );
    }

    const topPlatforms = [...platformTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([platform]) => platform);

    const rows = new Map<string, DynamicPoint>();

    for (const cell of cells) {
      if (!topPlatforms.includes(cell.platformName)) {
        continue;
      }

      const row = rows.get(cell.weekStart) ?? { weekStart: cell.weekStart };
      row[cell.platformName] = cell.avgCommissionPct;
      rows.set(cell.weekStart, row);
    }

    const points = [...rows.values()].sort((a, b) =>
      String(a.weekStart).localeCompare(String(b.weekStart)),
    );

    for (const point of points) {
      for (const platform of topPlatforms) {
        if (typeof point[platform] === 'undefined') {
          point[platform] = 0;
        }
      }
    }

    return { points, topPlatforms };
  }, [query.data?.cells]);

  return (
    <Card className='border-border/60 bg-card/90'>
      <CardHeader>
        <CardTitle className='text-base'>Commission Trends By Platform</CardTitle>
        <CardDescription>
          Average deduction percentage over time for the most complaint-prone platforms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className='h-72 w-full rounded-3xl' />
        ) : query.isError ? (
          <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
            Failed to load commission trends.
          </div>
        ) : series.points.length === 0 || series.topPlatforms.length === 0 ? (
          <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
            No commission trend data available yet.
          </div>
        ) : (
          <div className='h-72 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={series.points} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray='4 4' vertical={false} />
                <XAxis
                  dataKey='weekStart'
                  tickFormatter={formatWeekLabel}
                  minTickGap={20}
                />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Commission']}
                  labelFormatter={(label) => formatWeekLabel(String(label))}
                />
                {series.topPlatforms.map((platform, index) => (
                  <Line
                    key={platform}
                    dataKey={platform}
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
  );
}
