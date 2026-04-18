'use client';

import { useMemo } from 'react';
import { Clock3, Inbox, Timer } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetPendingScreenshots } from './_api/get-pending-screenshots';
import { ScreenshotReviewCard } from './_components/screenshot-review-card';

function averageWaitHours(uploadedAtValues: Array<string | Date>): number {
  if (uploadedAtValues.length === 0) {
    return 0;
  }

  const now = Date.now();
  const totalMs = uploadedAtValues.reduce((sum, uploadedAt) => {
    const timestamp = new Date(uploadedAt).getTime();
    if (Number.isNaN(timestamp)) {
      return sum;
    }

    return sum + Math.max(0, now - timestamp);
  }, 0);

  return totalMs / uploadedAtValues.length / (1000 * 60 * 60);
}

export default function VerifierQueuePage() {
  const { data, isLoading } = useGetPendingScreenshots();
  const screenshots = data?.data ?? [];

  const stats = useMemo(() => {
    const pendingCount = screenshots.length;
    const avgHours = averageWaitHours(screenshots.map((item) => item.uploadedAt));

    return {
      pendingCount,
      avgHours,
    };
  }, [screenshots]);

  return (
    <main className='mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8'>
      <section className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>Verification Queue</h1>
        <p className='text-sm text-muted-foreground'>
          Review pending screenshots and update worker verification status.
        </p>
      </section>

      <section className='grid gap-3 sm:grid-cols-2'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Pending reviews</CardTitle>
            <Inbox className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-20' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>{stats.pendingCount}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Average wait time</CardTitle>
            <Timer className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-28' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>{stats.avgHours.toFixed(1)}h</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className='space-y-4'>
        {isLoading &&
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className='space-y-2 rounded-2xl border p-4'>
              <Skeleton className='h-5 w-52' />
              <Skeleton className='h-32 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          ))}

        {!isLoading && screenshots.length === 0 && (
          <div className='rounded-2xl border border-dashed bg-muted/20 p-10 text-center'>
            <Clock3 className='mx-auto mb-3 size-8 text-muted-foreground/70' aria-hidden='true' />
            <p className='text-sm font-medium'>No pending screenshots right now</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              New uploads from workers will appear here for review.
            </p>
          </div>
        )}

        {!isLoading &&
          screenshots.map((screenshot) => (
            <ScreenshotReviewCard key={screenshot.id} screenshot={screenshot} />
          ))}
      </section>
    </main>
  );
}
