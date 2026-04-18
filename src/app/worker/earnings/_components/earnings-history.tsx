'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <div className='space-y-2'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-14 w-full' />
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-center text-muted-foreground'>
        <FileText className='size-10 mb-3 opacity-30' aria-hidden='true' />
        <p className='text-sm font-medium'>No shifts logged yet</p>
        <p className='text-xs mt-1'>Your shift history will appear here.</p>
        <Button size='sm' className='mt-4'>
          <a href='/worker/log-shift'>Log your first shift →</a>
        </Button>
      </div>
    );
  }

  return (
    <div className='rounded-lg border overflow-hidden'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
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
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
                  >
                    <StatusIcon className='size-3' aria-hidden='true' />
                    {config.label}
                  </span>
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
  );
}
