'use client';

import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useUpdateVerification } from '../_api/update-verification';
import type { ScreenshotQueueItem } from '../_api/get-pending-screenshots';
import {
  VerificationActionBar,
  type VerificationDecision,
} from './verification-action-bar';

interface ScreenshotReviewCardProps {
  screenshot: ScreenshotQueueItem;
}

type PersistedAiRemark = {
  version: 'shift-ai-review-v1';
  verdict: 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
  trustScore: number;
  confidence: number;
  model: string;
  summary: string;
  reasons: string[];
  mismatches: Array<{
    field: string;
    claimed: number;
    extracted: number;
    deltaPct: number;
    tolerancePct: number;
  }>;
  generatedAt: string;
};

function formatCurrency(value: unknown): string {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return '0';
  }

  return numberValue.toLocaleString();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function parseAiRemark(rawNote: string | null): PersistedAiRemark | null {
  if (!rawNote) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawNote) as Partial<PersistedAiRemark>;
    if (parsed.version !== 'shift-ai-review-v1' || typeof parsed.summary !== 'string') {
      return null;
    }

    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((item): item is string => typeof item === 'string')
      : [];
    const mismatches = Array.isArray(parsed.mismatches)
      ? parsed.mismatches
          .filter(
            (item): item is PersistedAiRemark['mismatches'][number] =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.field === 'string' &&
              Number.isFinite(Number(item.claimed)) &&
              Number.isFinite(Number(item.extracted)) &&
              Number.isFinite(Number(item.deltaPct)) &&
              Number.isFinite(Number(item.tolerancePct)),
          )
          .map((item) => ({
            field: item.field,
            claimed: Number(item.claimed),
            extracted: Number(item.extracted),
            deltaPct: Number(item.deltaPct),
            tolerancePct: Number(item.tolerancePct),
          }))
      : [];

    return {
      version: 'shift-ai-review-v1',
      verdict: parsed.verdict ?? 'PENDING',
      trustScore: Number(parsed.trustScore ?? 0),
      confidence: Number(parsed.confidence ?? 0),
      model: typeof parsed.model === 'string' ? parsed.model : 'unknown',
      summary: parsed.summary,
      reasons,
      mismatches,
      generatedAt:
        typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function decisionFromStatus(status: ScreenshotQueueItem['status']): VerificationDecision {
  if (status === 'CONFIRMED' || status === 'FLAGGED' || status === 'UNVERIFIABLE') {
    return status;
  }

  return 'CONFIRMED';
}

export function ScreenshotReviewCard({ screenshot }: ScreenshotReviewCardProps) {
  const aiRemark = parseAiRemark(screenshot.verifierNotes);
  const manualReviewerNote = aiRemark ? null : screenshot.verifierNotes?.trim() || null;
  const [decision, setDecision] = useState<VerificationDecision>(() =>
    decisionFromStatus(screenshot.status),
  );
  const [note, setNote] = useState<string>(() => manualReviewerNote ?? '');
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

        {aiRemark && (
          <div className='space-y-2 rounded-xl border border-amber-300/30 bg-amber-50/40 p-3 dark:border-amber-500/30 dark:bg-amber-950/10'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                AI remarks
              </p>
              <Badge variant={aiRemark.verdict === 'FLAGGED' ? 'destructive' : 'outline'}>
                {aiRemark.verdict}
              </Badge>
              <Badge variant='outline'>Trust {formatPercent(aiRemark.trustScore)}</Badge>
              <Badge variant='outline'>Confidence {formatPercent(aiRemark.confidence)}</Badge>
            </div>

            <p className='text-sm text-foreground/90'>{aiRemark.summary}</p>

            {aiRemark.reasons.length > 0 && (
              <div className='space-y-1'>
                {aiRemark.reasons.slice(0, 3).map((reason) => (
                  <p key={reason} className='text-xs text-muted-foreground'>
                    • {reason}
                  </p>
                ))}
              </div>
            )}

            {aiRemark.mismatches.length > 0 && (
              <div className='space-y-1'>
                {aiRemark.mismatches.slice(0, 2).map((mismatch) => (
                  <p
                    key={`${mismatch.field}-${mismatch.claimed}-${mismatch.extracted}`}
                    className='text-xs text-muted-foreground'
                  >
                    {mismatch.field}: claimed PKR {formatCurrency(mismatch.claimed)} vs
                    extracted PKR {formatCurrency(mismatch.extracted)} ({formatPercent(mismatch.deltaPct)}
                    {' '}delta)
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {manualReviewerNote && (
          <div className='rounded-xl border bg-muted/20 p-3'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Reviewer note
            </p>
            <p className='mt-2 text-sm whitespace-pre-wrap text-foreground/90'>
              {manualReviewerNote}
            </p>
          </div>
        )}

        <VerificationActionBar
          decision={decision}
          onDecisionChange={setDecision}
          note={note}
          onNoteChange={setNote}
          onSubmit={handleSubmit}
          isSubmitting={updateVerification.isPending}
          noteInputId={`verifier-note-${screenshot.id}`}
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
