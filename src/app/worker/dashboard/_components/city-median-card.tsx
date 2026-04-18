'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetMedian } from '../_api/use-get-median';

interface CityMedianCardProps {
  workerHourlyRate: number | null;
  category?: string;
  zone?: string;
}

export function CityMedianCard({
  workerHourlyRate,
  category,
  zone,
}: CityMedianCardProps) {
  const { data, isLoading } = useGetMedian(category, zone);

  const median = data?.data?.medianHourlyRate ?? null;

  const pct =
    median && workerHourlyRate !== null
      ? Math.min(Math.round((workerHourlyRate / median) * 100), 200)
      : null;

  const label =
    pct === null
      ? '—'
      : pct >= 100
        ? `${pct - 100}% above city median`
        : `${100 - pct}% below city median`;

  const barColor =
    pct === null
      ? 'bg-muted-foreground'
      : pct >= 100
        ? 'bg-emerald-500'
        : pct >= 80
          ? 'bg-amber-500'
          : 'bg-destructive';

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          vs. City Median{category ? ` — ${category.replace('_', ' ').toLowerCase()}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-2 w-full' />
          </div>
        ) : (
          <>
            <p className='text-2xl font-bold tabular-nums'>
              {workerHourlyRate !== null
                ? `PKR ${Math.round(workerHourlyRate).toLocaleString()}/hr`
                : '—'}
            </p>
            <p className='text-sm text-muted-foreground mt-1'>{label}</p>
            {pct !== null && (
              <div
                className='mt-3 w-full bg-muted rounded-full h-2 overflow-hidden'
                role='meter'
                aria-label={`Your earnings compared to city median: ${label}`}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={200}
              >
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
            {median && (
              <p className='text-xs text-muted-foreground mt-2'>
                City median: PKR {Math.round(median).toLocaleString()}/hr
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
