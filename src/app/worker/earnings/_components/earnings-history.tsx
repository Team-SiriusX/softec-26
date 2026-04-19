'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Clock,
  FileText,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Awaiting review',
    icon: Clock,
    className: 'border-border bg-secondary text-secondary-foreground',
  },
  CONFIRMED: {
    label: 'Verified',
    icon: BadgeCheck,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
  },
  FLAGGED: {
    label: 'Discrepancy flagged',
    icon: AlertTriangle,
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  },
  UNVERIFIABLE: {
    label: 'Could not be verified',
    icon: XCircle,
    className: 'border-destructive/40 bg-destructive/5 text-destructive',
  },
} as const;

type ShiftRow = {
  id: string;
  shiftDate: string | Date;
  platform: { name: string };
  netReceived: string | number;
  hoursWorked: string | number;
  grossEarned: string | number;
  platformDeductions: string | number;
  verificationStatus: keyof typeof STATUS_CONFIG;
  effectiveHourlyRate?: number;
};

interface EarningsHistoryProps {
  shifts: ShiftRow[];
  isLoading: boolean;
  onSelectShift: (id: string) => void;
}

export function EarningsHistory({
  shifts,
  isLoading,
  onSelectShift,
}: EarningsHistoryProps) {
  if (isLoading) {
    return (
      <div className='space-y-2 rounded-xl border border-border/70 p-3 sm:p-4'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-12 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-14 text-center text-muted-foreground'>
        <FileText className='size-10 mb-3 opacity-30' aria-hidden='true' />
        <p className='text-sm font-medium text-foreground'>No shifts logged yet</p>
        <p className='mt-1 max-w-sm text-xs leading-relaxed'>
          Start by logging your first shift to unlock verification tracking,
          trend analytics, and benchmark insights.
        </p>
        <Link
          href='/worker/log-shift'
          className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}
        >
          Log your first shift
        </Link>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-xl border border-border/70'>
      <div className='overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='min-w-32'>Date</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className='text-right tabular-nums'>Received (PKR)</TableHead>
            <TableHead className='text-right tabular-nums hidden sm:table-cell'>Rate/hr</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-8' aria-label='Actions' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => {
            const config = STATUS_CONFIG[shift.verificationStatus] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = config.icon;
            const rate =
              shift.effectiveHourlyRate ??
              (Number(shift.hoursWorked) > 0
                ? Number(shift.netReceived) / Number(shift.hoursWorked)
                : 0);

            return (
              <TableRow
                key={shift.id}
                className='cursor-pointer hover:bg-muted/50 transition-colors'
                onClick={() => onSelectShift(shift.id)}
                role='button'
                tabIndex={0}
                aria-label={`${shift.platform.name} shift on ${format(new Date(shift.shiftDate), 'dd MMM yyyy')} — View details`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectShift(shift.id);
                  }
                }}
              >
                <TableCell className='text-sm font-medium whitespace-nowrap'>
                  {format(new Date(shift.shiftDate), 'dd MMM yyyy')}
                </TableCell>
                <TableCell className='text-sm'>{shift.platform.name}</TableCell>
                <TableCell className='text-right text-sm tabular-nums font-medium'>
                  {Number(shift.netReceived).toLocaleString()}
                </TableCell>
                <TableCell className='text-right text-sm tabular-nums hidden sm:table-cell text-muted-foreground'>
                  {Math.round(rate).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant='outline'
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      config.className,
                    )}
                  >
                    <StatusIcon className='size-3' aria-hidden='true' />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChevronRight className='size-4 text-muted-foreground' aria-hidden='true' />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
