'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  ExternalLink,
  Upload,
  XCircle,
} from 'lucide-react';
import { useGetShift } from '../_api/get-shift';
import { format } from 'date-fns';
import Link from 'next/link';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Awaiting review',
    icon: Clock,
    description: 'A community reviewer will check this. It may take 24–48 hours.',
    color: 'text-muted-foreground',
  },
  CONFIRMED: {
    label: 'Verified ✓',
    icon: BadgeCheck,
    description: 'A community reviewer confirmed these figures match the screenshot.',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  FLAGGED: {
    label: 'Discrepancy flagged',
    icon: AlertTriangle,
    description:
      "A reviewer noticed a difference between what you entered and the screenshot. See the reviewer's note below.",
    color: 'text-amber-600 dark:text-amber-400',
  },
  UNVERIFIABLE: {
    label: 'Could not be verified',
    icon: XCircle,
    description:
      'The screenshot was unclear or missing. You can re-upload a clearer one.',
    color: 'text-destructive',
  },
} as const;

interface ShiftDetailSheetProps {
  shiftId: string | null;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className='flex justify-between items-start gap-2 py-2'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className='text-sm font-medium text-right'>{value}</span>
    </div>
  );
}

export function ShiftDetailSheet({ shiftId, onClose }: ShiftDetailSheetProps) {
  const { data, isLoading } = useGetShift(shiftId ?? '');
  const shiftResponse = data as { data?: Record<string, any> } | undefined;
  const shift = shiftResponse?.data;

  const status = (shift?.verificationStatus as keyof typeof STATUS_CONFIG) ?? 'PENDING';
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg?.icon ?? Clock;

  const effectiveRate =
    shift && Number(shift.hoursWorked) > 0
      ? Number(shift.netReceived) / Number(shift.hoursWorked)
      : null;

  const deductionPct =
    shift && Number(shift.grossEarned) > 0
      ? (Number(shift.platformDeductions) / Number(shift.grossEarned)) * 100
      : null;

  return (
    <Sheet open={!!shiftId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className='w-full sm:max-w-md overflow-y-auto'>
        <SheetHeader className='mb-4'>
          <SheetTitle>Shift Details</SheetTitle>
        </SheetHeader>

        {isLoading || !shift ? (
          <div className='space-y-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Platform + date header */}
            <div>
              <p className='text-xl font-bold'>
                {(shift.platform as { name: string }).name}
              </p>
              <p className='text-sm text-muted-foreground'>
                {format(new Date(shift.shiftDate as string), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>

            <Separator />

            {/* Earnings breakdown */}
            <div>
              <p className='text-xs uppercase tracking-wider text-muted-foreground mb-1 font-semibold'>
                Earnings Breakdown
              </p>
              <DetailRow
                label='Total earned (before platform cut)'
                value={`PKR ${Number(shift.grossEarned).toLocaleString()}`}
              />
              <DetailRow
                label='Platform cut'
                value={
                  <span>
                    PKR {Number(shift.platformDeductions).toLocaleString()}
                    {deductionPct !== null && (
                      <span className='text-muted-foreground text-xs ml-1'>
                        ({deductionPct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                }
              />
              <DetailRow
                label='Amount you received'
                value={
                  <span className='text-lg font-bold tabular-nums'>
                    PKR {Number(shift.netReceived).toLocaleString()}
                  </span>
                }
              />
              <Separator className='my-1' />
              <DetailRow
                label='Hours worked'
                value={`${Number(shift.hoursWorked)} hr${Number(shift.hoursWorked) !== 1 ? 's' : ''}`}
              />
              <DetailRow
                label='Effective hourly rate'
                value={
                  effectiveRate !== null
                    ? `PKR ${Math.round(effectiveRate).toLocaleString()}/hr`
                    : '—'
                }
              />
            </div>

            <Separator />

            {/* Verification status */}
            <div>
              <p className='text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold'>
                Verification
              </p>
              <div className={`flex items-center gap-2 ${statusCfg.color}`}>
                <StatusIcon className='size-4' aria-hidden='true' />
                <span className='text-sm font-semibold'>{statusCfg.label}</span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {statusCfg.description}
              </p>

              {/* Verifier note (shown on flagged/unverifiable) */}
              {(status === 'FLAGGED' || status === 'UNVERIFIABLE') &&
                shift.screenshot &&
                (shift.screenshot as { verifierNotes?: string }).verifierNotes && (
                  <div className='mt-2 p-3 rounded-lg bg-muted text-sm'>
                    <p className='font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1'>
                      Reviewer note
                    </p>
                    <p>{(shift.screenshot as { verifierNotes: string }).verifierNotes}</p>
                  </div>
                )}

              {/* Screenshot thumbnail */}
              {shift.screenshot && (shift.screenshot as { fileUrl?: string }).fileUrl && (
                <div className='mt-3'>
                  <p className='text-xs text-muted-foreground mb-1'>Screenshot</p>

                  <a
                    href={(shift.screenshot as { fileUrl: string }).fileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
                  >
                    <ExternalLink className='size-3' aria-hidden='true' />
                    View uploaded screenshot
                  </a>
                </div>
              )}

              {/* Re-upload option for flagged/unverifiable */}
              {(status === 'FLAGGED' || status === 'UNVERIFIABLE' || status === 'PENDING') && (
                <Button
                
                  size='sm'
                  variant='outline'
                  className='mt-3 gap-2'
                >
                  <Link href={`/worker/earnings/${shift.id as string}/upload`}>
                    <Upload className='size-3.5' aria-hidden='true' />
                    {shift.screenshot ? 'Re-upload screenshot' : 'Upload screenshot'}
                  </Link>
                </Button>
              )}
            </div>

            {shift.notes && (
              <>
                <Separator />
                <div>
                  <p className='text-xs uppercase tracking-wider text-muted-foreground mb-1 font-semibold'>
                    Notes
                  </p>
                  <p className='text-sm'>{shift.notes as string}</p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
