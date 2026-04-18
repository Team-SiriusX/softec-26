'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useGetShifts } from '@/app/worker/log-shift/_api/get-shifts';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  EarningsFilterBar,
  type EarningsFilters,
} from './_components/earnings-filter-bar';
import { EarningsHistory } from './_components/earnings-history';
import { IncomeAnalytics } from './_components/income-analytics';
import { ShiftDetailSheet } from './_components/shift-detail-sheet';

const defaultFilters: EarningsFilters = {
  platform: '',
  status: 'ALL',
  from: '',
  to: '',
};

export default function WorkerEarningsPage() {
  const [filters, setFilters] = useState<EarningsFilters>(defaultFilters);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

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
        <Button>
          <Link href='/worker/log-shift'>Log a shift</Link>
        </Button>
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

      <ShiftDetailSheet shiftId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
    </div>
  );
}
