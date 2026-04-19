'use client';

import Link from 'next/link';
import { type MouseEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Filter,
  Inbox,
  ShieldAlert,
  Timer,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  type ScreenshotQueueStatus,
  useGetScreenshots,
} from './_api/get-pending-screenshots';
import { ScreenshotReviewCard } from './_components/screenshot-review-card';

type QueueFilter = 'needs-review' | 'approved' | 'unverified';

const PAGE_SIZE = 8;

const FILTERS: Record<
  QueueFilter,
  {
    label: string;
    description: string;
    statuses: ScreenshotQueueStatus[];
  }
> = {
  'needs-review': {
    label: 'Pending + Flagged',
    description:
      'Default queue showing new uploads and AI-flagged logs that need reviewer action.',
    statuses: ['PENDING', 'FLAGGED'],
  },
  approved: {
    label: 'Approved',
    description: 'Previously verified logs that were confirmed by a reviewer.',
    statuses: ['CONFIRMED'],
  },
  unverified: {
    label: 'Unverified',
    description: 'Logs marked as unverifiable because the evidence was insufficient.',
    statuses: ['UNVERIFIABLE'],
  },
};

const EMPTY_STATS: Record<ScreenshotQueueStatus, number> = {
  PENDING: 0,
  CONFIRMED: 0,
  FLAGGED: 0,
  UNVERIFIABLE: 0,
};

const EMPTY_META = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

function parseQueueFilter(value: string | null): QueueFilter | null {
  if (value === 'needs-review' || value === 'approved') {
    return value;
  }

  if (value === 'unverified' || value === 'unverifiable') {
    return 'unverified';
  }

  return null;
}

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

function VerifierQueueContent() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>(
    () => parseQueueFilter(searchParams.get('filter')) ?? 'needs-review',
  );

  const activeFilterConfig = FILTERS[activeFilter];
  const { data, isLoading, isFetching } = useGetScreenshots({
    statuses: activeFilterConfig.statuses,
    page,
    pageSize: PAGE_SIZE,
  });

  const screenshots = useMemo(() => data?.data ?? [], [data?.data]);
  const statusStats = data?.stats ?? EMPTY_STATS;
  const meta = data?.meta ?? EMPTY_META;

  const dashboardStats = useMemo(() => {
    const pendingCount = statusStats.PENDING;
    const flaggedCount = statusStats.FLAGGED;
    const approvedCount = statusStats.CONFIRMED;
    const unverifiedCount = statusStats.UNVERIFIABLE;
    const needsReviewCount = pendingCount + flaggedCount;
    const avgHours = averageWaitHours(screenshots.map((item) => item.uploadedAt));

    return {
      needsReviewCount,
      pendingCount,
      flaggedCount,
      approvedCount,
      unverifiedCount,
      avgHours,
    };
  }, [
    screenshots,
    statusStats.CONFIRMED,
    statusStats.FLAGGED,
    statusStats.PENDING,
    statusStats.UNVERIFIABLE,
  ]);

  const filterCounts = useMemo(
    () => ({
      'needs-review': dashboardStats.pendingCount + dashboardStats.flaggedCount,
      approved: dashboardStats.approvedCount,
      unverified: dashboardStats.unverifiedCount,
    }),
    [
      dashboardStats.approvedCount,
      dashboardStats.flaggedCount,
      dashboardStats.pendingCount,
      dashboardStats.unverifiedCount,
    ],
  );

  const rangeStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const rangeEnd = meta.total === 0 ? 0 : Math.min(meta.page * meta.pageSize, meta.total);

  const goToPreviousPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!meta.hasPrevPage) {
      return;
    }

    setPage(Math.max(1, meta.page - 1));
  };

  const goToNextPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!meta.hasNextPage) {
      return;
    }

    setPage(meta.page + 1);
  };

  const handleFilterChange = (value: string) => {
    const nextFilter = parseQueueFilter(value);
    if (!nextFilter || nextFilter === activeFilter) {
      return;
    }

    setActiveFilter(nextFilter);
    setPage(1);
  };

  return (
    <main className='mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8'>
      <section className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>Verification Queue</h1>
          <p className='text-sm text-muted-foreground'>
            Review screenshot evidence with AI remarks. The default view shows pending and
            flagged logs, while approved and unverified logs are available through filters.
          </p>
          {isFetching && !isLoading && (
            <p className='text-xs text-muted-foreground'>Refreshing queue results...</p>
          )}
        </div>

        <Link
          href='/verifier/dashboard'
          className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}
        >
          <ArrowLeft className='size-4' aria-hidden='true' />
          Back to dashboard
        </Link>
      </section>

      <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Needs review</CardTitle>
            <Inbox className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-20' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.needsReviewCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Pending</CardTitle>
            <Timer className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-28' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.pendingCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Flagged</CardTitle>
            <AlertTriangle className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-20' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.flaggedCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Approved</CardTitle>
            <CheckCircle2 className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-20' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.approvedCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Unverified</CardTitle>
            <ShieldAlert className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-20' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.unverifiedCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Avg wait (shown)</CardTitle>
            <Clock3 className='size-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-8 w-28' />
            ) : (
              <p className='text-3xl font-bold tabular-nums'>
                {dashboardStats.avgHours.toFixed(1)}h
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className='space-y-3 rounded-2xl border bg-card/40 p-4'>
        <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          <Filter className='size-3.5' aria-hidden='true' />
          Queue filters
        </div>

        <Tabs value={activeFilter} onValueChange={handleFilterChange} className='gap-2'>
          <TabsList variant='line' className='h-auto w-full justify-start rounded-none p-0'>
            <TabsTrigger
              value='needs-review'
              className='rounded-none border-b-2 border-transparent px-3 py-2 data-active:border-primary'
            >
              {FILTERS['needs-review'].label} ({filterCounts['needs-review']})
            </TabsTrigger>
            <TabsTrigger
              value='approved'
              className='rounded-none border-b-2 border-transparent px-3 py-2 data-active:border-primary'
            >
              {FILTERS.approved.label} ({filterCounts.approved})
            </TabsTrigger>
            <TabsTrigger
              value='unverified'
              className='rounded-none border-b-2 border-transparent px-3 py-2 data-active:border-primary'
            >
              {FILTERS.unverified.label} ({filterCounts.unverified})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className='text-xs text-muted-foreground'>{activeFilterConfig.description}</p>
      </section>

      <Separator />

      <section className='space-y-4'>
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className='space-y-2 rounded-2xl border p-4'>
              <Skeleton className='h-5 w-52' />
              <Skeleton className='h-32 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          ))}

        {!isLoading && screenshots.length === 0 && (
          <div className='rounded-2xl border border-dashed bg-muted/20 p-10 text-center'>
            <Clock3 className='mx-auto mb-3 size-8 text-muted-foreground/70' aria-hidden='true' />
            <p className='text-sm font-medium'>No logs found in this queue</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Try another filter to inspect a different verification status.
            </p>
          </div>
        )}

        {!isLoading &&
          screenshots.map((screenshot) => (
            <ScreenshotReviewCard key={screenshot.id} screenshot={screenshot} />
          ))}

        {!isLoading && meta.total > 0 && (
          <div className='flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <p className='text-xs text-muted-foreground'>
              Showing {rangeStart}-{rangeEnd} of {meta.total} logs
            </p>

            {meta.totalPages > 1 && (
              <Pagination className='mx-0 w-auto justify-end'>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      onClick={goToPreviousPage}
                      className={
                        !meta.hasPrevPage ? 'pointer-events-none opacity-50' : undefined
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className='px-2 text-xs text-muted-foreground'>
                      Page {meta.page} of {meta.totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      onClick={goToNextPage}
                      className={
                        !meta.hasNextPage ? 'pointer-events-none opacity-50' : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function VerifierQueuePage() {
  return (
    <Suspense
      fallback={
        <main className='mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-4 w-full' />
          </div>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className='pb-2'>
                  <Skeleton className='h-4 w-20' />
                </CardHeader>
                <CardContent>
                  <Skeleton className='h-8 w-16' />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className='h-12 w-full' />
          <div className='space-y-4'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-40 w-full' />
            ))}
          </div>
        </main>
      }
    >
      <VerifierQueueContent />
    </Suspense>
  );
}
