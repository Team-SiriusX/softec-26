'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { AlertTriangle, BadgeCheck, Clock, Plus, Trash2, XCircle } from 'lucide-react';
import { type ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteShift } from '../log-shift/_api/delete-shift';
import { useGetShifts } from '../log-shift/_api/get-shifts';

type ShiftStatus = 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';

type ShiftLogItem = {
  id: string;
  shiftDate: string;
  platform: {
    name: string;
  };
  hoursWorked: number;
  grossEarned: number;
  platformDeductions: number;
  netReceived: number;
  verificationStatus: ShiftStatus;
  screenshots?: Array<{
    fileKey: string;
    verifierNotes?: string | null;
    status?: ShiftStatus;
  }>;
  aiReview?: {
    summary: string | null;
    reasons: string[];
    model: string | null;
    trustScore: number | null;
    confidence: number | null;
    generatedAt: string | null;
  } | null;
};

const STATUS_STYLES: Record<
  ShiftStatus,
  {
    label: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  PENDING: {
    label: 'Queued',
    className: 'border-border bg-secondary text-secondary-foreground',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'AI Confirmed',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
    icon: BadgeCheck,
  },
  FLAGGED: {
    label: 'Flagged',
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    icon: AlertTriangle,
  },
  UNVERIFIABLE: {
    label: 'Unverifiable',
    className: 'border-destructive/40 bg-destructive/5 text-destructive',
    icon: XCircle,
  },
};

export default function MyShiftLogsPage() {
  const shiftsQuery = useGetShifts();
  const deleteShift = useDeleteShift();

  const shifts = ((shiftsQuery.data as { data?: ShiftLogItem[] } | undefined)?.data ?? []) as ShiftLogItem[];

  const handleDelete = (shiftId: string) => {
    const shouldDelete = window.confirm(
      'Delete this shift log permanently? This cannot be undone.',
    );

    if (!shouldDelete) {
      return;
    }

    deleteShift.mutate(shiftId);
  };

  return (
    <main className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>My Shift Logs</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            View all submitted shifts. Logs are immutable: create new or delete existing.
          </p>
        </div>

        <Link href='/worker/log-shift'>
          <Button className='min-h-10'>
            <Plus className='size-4' />
            Create Shift Log
          </Button>
        </Link>
      </div>

      {shiftsQuery.isLoading ? (
        <div className='space-y-3'>
          <Skeleton className='h-20 rounded-2xl' />
          <Skeleton className='h-20 rounded-2xl' />
          <Skeleton className='h-20 rounded-2xl' />
        </div>
      ) : shifts.length === 0 ? (
        <Card className='border-dashed'>
          <CardContent className='p-6 text-sm text-muted-foreground'>
            No shift logs yet. Create your first one to start AI screenshot validation.
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {shifts.map((shift) => {
            const status = STATUS_STYLES[shift.verificationStatus] ?? STATUS_STYLES.PENDING;
            const StatusIcon = status.icon;

            return (
              <Card key={shift.id} className='border-border/60 bg-card/90'>
                <CardHeader className='space-y-2'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <CardTitle className='text-base'>
                      {shift.platform.name} · {format(new Date(shift.shiftDate), 'dd MMM yyyy')}
                    </CardTitle>

                    <Badge className={`inline-flex items-center gap-1 border ${status.className}`}>
                      <StatusIcon className='size-3.5' />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className='space-y-3'>
                  <div className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-4'>
                    <p>
                      Gross:{' '}
                      <span className='font-medium text-foreground'>
                        PKR {Number(shift.grossEarned).toLocaleString()}
                      </span>
                    </p>
                    <p>
                      Deductions:{' '}
                      <span className='font-medium text-foreground'>
                        PKR {Number(shift.platformDeductions).toLocaleString()}
                      </span>
                    </p>
                    <p>
                      Net:{' '}
                      <span className='font-medium text-foreground'>
                        PKR {Number(shift.netReceived).toLocaleString()}
                      </span>
                    </p>
                    <p>
                      Screenshots:{' '}
                      <span className='font-medium text-foreground'>
                        {shift.screenshots?.length ?? 0}
                      </span>
                    </p>
                  </div>

                  {shift.verificationStatus === 'FLAGGED' ? (
                    <div className='space-y-2 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200'>
                      <p className='text-xs font-semibold tracking-wide'>
                        Why AI flagged this shift
                      </p>

                      {shift.aiReview?.summary ? (
                        <p className='text-xs leading-relaxed'>
                          {shift.aiReview.summary}
                        </p>
                      ) : null}

                      {shift.aiReview?.reasons?.length ? (
                        <ul className='list-disc space-y-1 pl-5 text-xs leading-relaxed'>
                          {shift.aiReview.reasons.slice(0, 8).map((reason, index) => (
                            <li key={`${shift.id}-reason-${index}`}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className='text-xs leading-relaxed'>
                          Detailed AI reason not available for this older review record.
                        </p>
                      )}

                      <div className='flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-amber-900/80 dark:text-amber-200/80'>
                        {shift.aiReview?.model ? (
                          <span>Model: {shift.aiReview.model}</span>
                        ) : null}

                        {typeof shift.aiReview?.confidence === 'number' ? (
                          <span>
                            Confidence: {Math.round(shift.aiReview.confidence * 100)}%
                          </span>
                        ) : null}

                        {typeof shift.aiReview?.trustScore === 'number' ? (
                          <span>
                            Trust: {Math.round(shift.aiReview.trustScore * 100)}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className='flex flex-wrap gap-2'>
                    <Link href='/worker/log-shift'>
                      <Button type='button' variant='outline' className='min-h-10'>
                        <Plus className='size-4' />
                        Create New Log
                      </Button>
                    </Link>

                    {shift.verificationStatus === 'FLAGGED' ||
                    shift.verificationStatus === 'UNVERIFIABLE' ? (
                      <Link
                        href={`/worker/log-shift?guided=1&source=my_shift_logs&shiftId=${encodeURIComponent(
                          shift.id,
                        )}`}
                      >
                        <Button type='button' variant='outline' className='min-h-10'>
                          <AlertTriangle className='size-4' />
                          Fix With AI Guidance
                        </Button>
                      </Link>
                    ) : null}

                    <Button
                      type='button'
                      variant='destructive'
                      className='min-h-10'
                      disabled={deleteShift.isPending}
                      onClick={() => handleDelete(shift.id)}
                    >
                      <Trash2 className='size-4' />
                      Delete Log
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
