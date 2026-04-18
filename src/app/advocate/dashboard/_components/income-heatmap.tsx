'use client';

import { useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetIncomeDistribution } from '../_api/get-income-distribution';

const moneyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

function blockColor(value: number, max: number) {
  if (max <= 0) {
    return 'hsla(197, 89%, 38%, 0.2)';
  }

  const ratio = Math.min(1, value / max);
  const hue = 204 - ratio * 110;
  const alpha = 0.22 + ratio * 0.66;

  return `hsla(${hue}, 88%, 40%, ${alpha})`;
}

export function IncomeHeatmap() {
  const query = useGetIncomeDistribution();

  const nodes = useMemo(() => {
    const items = [...(query.data?.nodes ?? [])].sort(
      (a, b) => b.workerCount - a.workerCount,
    );

    return {
      items,
      maxMedianNet: Math.max(...items.map((item) => item.medianNetEarned), 0),
    };
  }, [query.data?.nodes]);

  return (
    <Card className='border-border/60 bg-card/90'>
      <CardHeader>
        <CardTitle className='text-base'>Income Distribution By City Zone</CardTitle>
        <CardDescription>
          Zone block size reflects worker count and color intensity reflects median earnings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className='h-72 w-full rounded-3xl' />
        ) : query.isError ? (
          <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
            Failed to load zone income distribution.
          </div>
        ) : nodes.items.length === 0 ? (
          <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
            No zone distribution data available yet.
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {nodes.items.map((node) => (
              <article
                key={node.cityZone}
                className='rounded-3xl border border-white/20 p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5'
                style={{
                  backgroundColor: blockColor(node.medianNetEarned, nodes.maxMedianNet),
                  minHeight: `${96 + Math.min(node.workerCount, 90)}px`,
                }}
              >
                <p className='text-sm font-semibold text-foreground'>{node.cityZone}</p>
                <p className='mt-2 text-xs text-foreground/85'>Workers: {node.workerCount.toLocaleString()}</p>
                <p className='text-xs text-foreground/85'>Median net: {moneyFormatter.format(node.medianNetEarned)}</p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
