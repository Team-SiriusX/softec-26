'use client';

import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ExternalLink } from 'lucide-react';

import { useUpdateVerification } from '../_api/update-verification';
import type { ScreenshotQueueItem } from '../_api/get-pending-screenshots';
import {
  VerificationActionBar,
  type VerificationDecision,
} from './verification-action-bar';

interface ScreenshotReviewCardProps {
  screenshot: ScreenshotQueueItem;
}

function formatCurrency(value: unknown): string {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return '0';
  }

  return numberValue.toLocaleString();
}

export function ScreenshotReviewCard({ screenshot }: ScreenshotReviewCardProps) {
  const [decision, setDecision] = useState<VerificationDecision>('CONFIRMED');
  const [note, setNote] = useState('');
  const updateVerification = useUpdateVerification();

  const uploadedAt = screenshot.uploadedAt
    ? formatDistanceToNowStrict(new Date(screenshot.uploadedAt), { addSuffix: true })
    : 'recently';

  const shift = screenshot.shiftLog;
  const worker = shift.worker;

  const handleSubmit = () => {
    updateVerification.mutate({
      param: { id: screenshot.id },
      json: {
        status: decision,
        verifierNotes: note.trim() ? note.trim() : undefined,
      },
    });
  };

  return (
    <article className='grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {shift.platform.name} shift review
            </p>
            <p className='text-xs text-muted-foreground'>
              Uploaded {uploadedAt} by {worker.fullName || 'Worker'}
            </p>
          </div>
          <span className='rounded-full border px-2 py-1 text-xs font-medium text-muted-foreground'>
            {worker.cityZone || 'Zone unavailable'}
          </span>
        </div>

        <div className='rounded-xl border bg-muted/30 p-3'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Claimed figures
          </p>
          <div className='mt-2 grid gap-2 text-sm sm:grid-cols-2'>
            <p>
              <span className='text-muted-foreground'>Gross:</span> PKR{' '}
              {formatCurrency(shift.grossEarned)}
            </p>
            <p>
              <span className='text-muted-foreground'>Net:</span> PKR{' '}
              {formatCurrency(shift.netReceived)}
            </p>
            <p>
              <span className='text-muted-foreground'>Deductions:</span> PKR{' '}
              {formatCurrency(shift.platformDeductions)}
            </p>
            <p>
              <span className='text-muted-foreground'>Hours:</span> {formatCurrency(shift.hoursWorked)}
            </p>
          </div>
        </div>

        <VerificationActionBar
          decision={decision}
          onDecisionChange={setDecision}
          note={note}
          onNoteChange={setNote}
          onSubmit={handleSubmit}
          isSubmitting={updateVerification.isPending}
        />
      </div>

      <div className='space-y-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Screenshot evidence
        </p>
        <a
          href={screenshot.fileUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='group block overflow-hidden rounded-xl border bg-muted/40'
        >
          <img
            src={screenshot.fileUrl}
            alt='Uploaded earnings screenshot for verification'
            className='h-full max-h-115 w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]'
            loading='lazy'
          />
        </a>
        <a
          href={screenshot.fileUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
        >
          Open full image
          <ExternalLink className='size-3' aria-hidden='true' />
        </a>
      </div>
    </article>
  );
}
