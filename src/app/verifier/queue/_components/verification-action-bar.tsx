'use client';

import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type VerificationDecision = 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';

interface VerificationActionBarProps {
  note: string;
  decision: VerificationDecision;
  onDecisionChange: (value: VerificationDecision) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  noteInputId?: string;
  isSubmitting?: boolean;
}

export function VerificationActionBar({
  note,
  decision,
  onDecisionChange,
  onNoteChange,
  onSubmit,
  noteInputId = 'verifier-note',
  isSubmitting = false,
}: VerificationActionBarProps) {
  const requiresNote = decision === 'FLAGGED' || decision === 'UNVERIFIABLE';
  const noteIsInvalid = requiresNote && note.trim().length === 0;

  const helperText = useMemo(() => {
    if (decision === 'CONFIRMED') {
      return 'Optional: add context for this confirmation.';
    }

    return 'Required: explain what does not match or why this screenshot is unreadable.';
  }, [decision]);

  return (
    <div className='space-y-3 rounded-xl border bg-card p-4'>
      <div className='space-y-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Verification decision
        </p>
        <div className='grid gap-2 sm:grid-cols-3'>
          <Button
            type='button'
            variant={decision === 'CONFIRMED' ? 'default' : 'outline'}
            onClick={() => onDecisionChange('CONFIRMED')}
            disabled={isSubmitting}
          >
            Confirm
          </Button>
          <Button
            type='button'
            variant={decision === 'FLAGGED' ? 'default' : 'outline'}
            onClick={() => onDecisionChange('FLAGGED')}
            disabled={isSubmitting}
          >
            Flag discrepancy
          </Button>
          <Button
            type='button'
            variant={decision === 'UNVERIFIABLE' ? 'default' : 'outline'}
            onClick={() => onDecisionChange('UNVERIFIABLE')}
            disabled={isSubmitting}
          >
            Mark unverifiable
          </Button>
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor={noteInputId}>Reviewer note</Label>
        <Textarea
          id={noteInputId}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          aria-invalid={noteIsInvalid}
          placeholder={
            decision === 'CONFIRMED'
              ? 'Optional note for audit trail...'
              : 'Explain the discrepancy or why this image is unclear.'
          }
          disabled={isSubmitting}
        />
        <p className='text-xs text-muted-foreground'>{helperText}</p>
        {noteIsInvalid && (
          <p className='text-xs font-medium text-destructive'>
            A note is required for flagged or unverifiable decisions.
          </p>
        )}
      </div>

      <Button
        type='button'
        className='w-full sm:w-auto'
        disabled={isSubmitting || noteIsInvalid}
        onClick={onSubmit}
      >
        {isSubmitting ? 'Saving review...' : 'Save review'}
      </Button>
    </div>
  );
}
